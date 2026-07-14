// ─── DocMind AI — Document Service (Orchestration Layer) ──────────────────
// Coordinates the full pipeline for every uploaded document:
//   File → Type Detection → Extraction → Quality Gate → AI Parse
//   → Merge → Chunk → RAG Index → Document Store
//
// Improvements over v1:
//   - Removed all artificial delays (was adding ~1.8s of dead wait per upload)
//   - Quality gate: garbage rawText is caught BEFORE it reaches Groq
//   - AI parse result is merged carefully — regex wins for field labels/themes,
//     AI wins for field VALUES (so labels always match chatService patterns)
//   - structuredDocs are passed to the chat route so the LLM sees clean fields
//   - No more silent swallowing of errors; extraction failures are surfaced

import type {
  Document,
  UploadQueueItem,
  UploadResult,
  UploadStatus,
} from "@/lib/types";
import {
  extractTextFromPDF,
  getPDFPageCount,
} from "@/lib/extraction/pdfExtractor";
import { extractTextFromImage } from "@/lib/extraction/imageExtractor";
import { extractTextFromDocx } from "@/lib/extraction/docxExtractor";
import { parseExtractedText } from "@/lib/extraction/textParser";

// ─── Interface contract ────────────────────────────────────────────────────
export interface IDocumentService {
  getDocuments(): Promise<Document[]>;
  getDocumentById(id: string): Promise<Document | null>;
  uploadDocument(file: File): Promise<UploadResult>;
  deleteDocument(id: string): Promise<void>;
}

// ─── In-memory store ───────────────────────────────────────────────────────
let _documents: Document[] = [];

export const documentService: IDocumentService = {
  async getDocuments(): Promise<Document[]> {
    return [..._documents];
  },

  async getDocumentById(id: string): Promise<Document | null> {
    return _documents.find((d) => d.id === id) ?? null;
  },

  async uploadDocument(file: File): Promise<UploadResult> {
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return { documentId: id, status: "queued" };
  },

  async deleteDocument(id: string): Promise<void> {
    _documents = _documents.filter((d) => d.id !== id);

    // Also remove from RAG store (client-side only — guard for SSR)
    if (typeof window !== "undefined") {
      try {
        const { removeDocument } = await import("@/lib/ragStore");
        removeDocument(id);
      } catch {
        // Non-fatal if RAG store removal fails
      }
    }
  },
};

export function _addDocumentToStore(doc: Document): void {
  _documents = [doc, ..._documents.filter((d) => d.id !== doc.id)];
}

// ─── File type detection ───────────────────────────────────────────────────
function getFileType(filename: string): Document["fileType"] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.match(/\.(jpg|jpeg|png|webp|gif|bmp|tiff?)$/)) return "image";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "docx";
  return "other";
}

// ─── Text quality gate ─────────────────────────────────────────────────────
// Returns true if rawText contains enough meaningful content to be processed.
// Prevents garbage from pdf.js artifacts / blank scans reaching the LLM.
function isTextMeaningful(text: string): boolean {
  if (!text || text.trim().length < 30) return false;
  // Count alphanumeric characters (Latin + Devanagari)
  const meaningful = (text.match(/[a-zA-Z0-9\u0900-\u097F]/g) ?? []).length;
  return meaningful >= 25;
}

// ─── Merge AI + regex results ──────────────────────────────────────────────
// PHILOSOPHY:
//   - AI (Groq) is the PRIMARY source of truth — it reads any language,
//     handles broken fonts via dual TEXT_LAYER + VISION_OCR input, and
//     extracts fields regex cannot know about
//   - Regex (textParser) provides theme/emoji/tags only — structural metadata
//   - If AI returns fields → use AI fields entirely
//   - If AI fails → use regex fields as fallback
function mergeParseResults(
  regexResult: ReturnType<typeof parseExtractedText>,
  aiResult: Record<string, unknown> | null,
): ReturnType<typeof parseExtractedText> {
  // If AI failed entirely, use regex result as-is
  if (
    !aiResult ||
    typeof aiResult !== "object" ||
    !Array.isArray(aiResult.extractedFields)
  ) {
    return regexResult;
  }

  // AI has results — use AI fields as the complete field list
  const aiFields = (
    aiResult.extractedFields as Array<{
      label: string;
      value: string;
      fieldType?: string;
    }>
  )
    .filter(
      (f) =>
        f.label &&
        f.value &&
        String(f.value).trim().length > 0 &&
        String(f.value).length < 400,
    )
    .map((f) => ({
      label: String(f.label).trim(),
      value: String(f.value).trim(),
      fieldType:
        (f.fieldType as
          | "text"
          | "number"
          | "date"
          | "id"
          | "address"
          | "url") ?? "text",
    }));

  // If AI returned no usable fields, fall back to regex
  const finalFields =
    aiFields.length > 0 ? aiFields : regexResult.extractedFields;

  // documentType from AI — accept any string (not limited to our enum)
  const aiDocType =
    typeof aiResult.documentType === "string" &&
    aiResult.documentType.trim().length > 0
      ? aiResult.documentType.trim()
      : null;

  // Resolve to known type for theme/emoji mapping; unknown types stay as generic
  const resolvedDocType =
    aiDocType && isKnownDocType(aiDocType)
      ? (aiDocType as ReturnType<typeof parseExtractedText>["documentType"])
      : regexResult.documentType;

  return {
    documentType: resolvedDocType,
    category:
      typeof aiResult.category === "string" &&
      aiResult.category.trim().length > 0
        ? (aiResult.category as ReturnType<
            typeof parseExtractedText
          >["category"])
        : regexResult.category,
    summary:
      typeof aiResult.summary === "string" &&
      aiResult.summary.trim().length > 10
        ? aiResult.summary.trim()
        : regexResult.summary,
    tags: regexResult.tags,
    thumbnailColor: regexResult.thumbnailColor,
    thumbnailEmoji: regexResult.thumbnailEmoji,
    extractedFields: finalFields,
  };
}

// Known DocumentType values for theme/emoji mapping
const KNOWN_DOC_TYPES = new Set([
  "aadhaar_card",
  "pan_card",
  "passport",
  "student_id",
  "employee_id",
  "resume",
  "marksheet",
  "income_certificate",
  "caste_certificate",
  "bank_statement",
  "offer_letter",
  "government_certificate",
  "generic",
]);
function isKnownDocType(t: string): boolean {
  return KNOWN_DOC_TYPES.has(t);
}

// ─── Main Upload Pipeline ──────────────────────────────────────────────────
export async function simulateUploadProgress(
  item: UploadQueueItem,
  onProgress: (id: string, progress: number, status: UploadStatus) => void,
  onComplete: (id: string, doc?: Document) => void,
  userId?: string,
): Promise<void> {
  const fileType = getFileType(item.name);

  // ── Phase 1: Start upload (0→30%) ─────────────────────────────────────
  onProgress(item.id, 15, "uploading");
  onProgress(item.id, 30, "uploading");

  // ── Phase 2: Extract text (30→70%) ────────────────────────────────────
  onProgress(item.id, 45, "processing");

  let rawText = "";
  let pageCount = 1;
  let extractionError: string | null = null;

  if (item.file) {
    try {
      if (fileType === "pdf") {
        const [text, count] = await Promise.all([
          extractTextFromPDF(item.file),
          getPDFPageCount(item.file),
        ]);
        rawText = text;
        pageCount = count;
      } else if (fileType === "image") {
        rawText = await extractTextFromImage(item.file);
        pageCount = 1;
      } else if (fileType === "docx") {
        rawText = await extractTextFromDocx(item.file);
        pageCount = 1;
      } else {
        rawText = item.name.replace(/\.[^.]+$/, ""); // filename without extension
      }
    } catch (err) {
      console.error("[documentService] Extraction error:", err);
      extractionError = err instanceof Error ? err.message : String(err);
      rawText = "";
    }
  }

  onProgress(item.id, 70, "processing");

  // ── Phase 3: Quality gate + AI parse (70→95%) ─────────────────────────
  // Use filename as fallback text only — enough to detect doc type by name
  const effectiveText = isTextMeaningful(rawText) ? rawText : item.name;
  const usedFallback = !isTextMeaningful(rawText);

  if (usedFallback && extractionError) {
    console.warn(
      `[documentService] Extraction failed for "${item.name}": ${extractionError}. Using filename fallback.`,
    );
  } else if (usedFallback) {
    console.warn(
      `[documentService] Extracted text for "${item.name}" is below quality threshold. Using filename fallback.`,
    );
  }

  // Run regex parser first — always reliable, no network call
  const regexResult = parseExtractedText(effectiveText, item.name);

  // Attempt AI parse — only if we have meaningful text (don't waste tokens on garbage)
  let aiResult: Record<string, unknown> | null = null;
  if (isTextMeaningful(rawText)) {
    try {
      const res = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText.slice(0, 12000), // Groq llama-3.3-70b supports 128k context
          filename: item.name,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as Record<string, unknown>;
        if (!json.error) aiResult = json;
      }
    } catch (err) {
      console.warn("[documentService] AI parse failed, using regex only:", err);
    }
  }

  onProgress(item.id, 95, "processing");

  // Merge results: regex labels + AI values where they match
  const parseResult = mergeParseResults(regexResult, aiResult);

  onProgress(item.id, 100, "completed");

  // ── Build final Document record ────────────────────────────────────────
  const docId = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const completedDoc: Document = {
    id: docId,
    name: item.name,
    fileType,
    category: parseResult.category,
    documentType: parseResult.documentType,
    sizeBytes: item.file?.size ?? 0,
    sizeLabel: item.sizeLabel,
    pages: pageCount,
    uploadedAt: new Date().toISOString(),
    uploadedAtLabel: "Just now",
    thumbnailColor: parseResult.thumbnailColor,
    thumbnailEmoji: parseResult.thumbnailEmoji,
    tags: parseResult.tags,
    summary: parseResult.summary,
    extractedInfo:
      parseResult.extractedFields.length > 0
        ? parseResult.extractedFields
        : undefined,
    aiSummary: parseResult.summary,
    rawText: isTextMeaningful(rawText) ? rawText : undefined,
    userId: userId ?? undefined,
  };

  // ── Phase 4: Chunk + index for RAG ────────────────────────────────────
  // Only chunk if we have meaningful text — no point indexing filename strings
  if (isTextMeaningful(rawText)) {
    try {
      const [{ chunkText }, { addChunks }] = await Promise.all([
        import("@/lib/chunker"),
        import("@/lib/ragStore"),
      ]);
      const chunks = chunkText(rawText, docId, item.name, parseResult.category);
      if (chunks.length > 0) {
        addChunks(docId, chunks, userId);
        console.log(
          `[documentService] Indexed ${chunks.length} chunks for "${item.name}" (${parseResult.documentType})`,
        );
      }
    } catch (err) {
      console.warn("[documentService] Chunking/indexing failed:", err);
    }
  } else {
    console.log(
      `[documentService] Skipping RAG indexing for "${item.name}" — no meaningful text`,
    );
  }

  _addDocumentToStore(completedDoc);
  onComplete(item.id, completedDoc);
}
