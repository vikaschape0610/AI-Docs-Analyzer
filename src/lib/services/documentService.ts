// ─── DocMind AI — Document Service (Orchestration Layer) ──────────────────
// Pipeline: File → OCR → Classify → Extract (AI) → Validate → Chunk → Index
//
// Stage callbacks allow the upload UI to show live progress per stage.

import type {
  Document,
  UploadQueueItem,
  UploadResult,
  UploadStatus,
  UploadStageKey,
  UploadStageStatus,
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

let _documents: Document[] = [];

export const documentService: IDocumentService = {
  async getDocuments() {
    return [..._documents];
  },
  async getDocumentById(id) {
    return _documents.find((d) => d.id === id) ?? null;
  },
  async uploadDocument(file) {
    return { documentId: `doc-${Date.now()}`, status: "queued" };
  },
  async deleteDocument(id) {
    _documents = _documents.filter((d) => d.id !== id);
    if (typeof window !== "undefined") {
      try {
        const { removeDocument } = await import("@/lib/ragStore");
        removeDocument(id);
      } catch {
        /* non-critical */
      }
    }
  },
};

export function _addDocumentToStore(doc: Document): void {
  _documents = [doc, ..._documents.filter((d) => d.id !== doc.id)];
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function getFileType(filename: string): Document["fileType"] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.match(/\.(jpg|jpeg|png|webp|gif|bmp|tiff?)$/)) return "image";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "docx";
  return "other";
}

function isTextMeaningful(text: string): boolean {
  if (!text || text.trim().length < 30) return false;
  return (text.match(/[a-zA-Z0-9\u0900-\u097F]/g) ?? []).length >= 25;
}

// ─── AI-primary merge ─────────────────────────────────────────────────────
function mergeParseResults(
  regexResult: ReturnType<typeof parseExtractedText>,
  aiResult: Record<string, unknown> | null,
): ReturnType<typeof parseExtractedText> {
  if (!aiResult || !Array.isArray(aiResult.extractedFields)) return regexResult;

  const aiFields = (
    aiResult.extractedFields as Array<{
      label: string;
      value: string;
      fieldType?: string;
      confidence?: number;
      page?: number;
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
      confidence: typeof f.confidence === "number" ? f.confidence : 0.85,
      page: f.page,
      source: "ai" as const,
    }));

  const finalFields =
    aiFields.length > 0 ? aiFields : regexResult.extractedFields;

  const KNOWN_TYPES = new Set([
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
    "driving_licence",
    "voter_id",
    "birth_certificate",
    "government_certificate",
    "generic",
  ]);

  const aiDocType =
    typeof aiResult.documentType === "string"
      ? aiResult.documentType.trim()
      : null;
  const resolvedDocType =
    aiDocType && KNOWN_TYPES.has(aiDocType)
      ? (aiDocType as ReturnType<typeof parseExtractedText>["documentType"])
      : regexResult.documentType;

  return {
    documentType: resolvedDocType,
    category:
      typeof aiResult.category === "string"
        ? (aiResult.category as ReturnType<
            typeof parseExtractedText
          >["category"])
        : regexResult.category,
    summary:
      typeof aiResult.summary === "string" && aiResult.summary.length > 10
        ? aiResult.summary
        : regexResult.summary,
    tags: regexResult.tags,
    thumbnailColor: regexResult.thumbnailColor,
    thumbnailEmoji: regexResult.thumbnailEmoji,
    extractedFields: finalFields,
  };
}

// ─── Stage callback type ───────────────────────────────────────────────────
type StageCallback = (
  id: string,
  key: UploadStageKey,
  status: UploadStageStatus,
) => void;

// ─── Main Upload Pipeline ──────────────────────────────────────────────────
export async function simulateUploadProgress(
  item: UploadQueueItem,
  onProgress: (id: string, progress: number, status: UploadStatus) => void,
  onComplete: (id: string, doc?: Document) => void,
  userId?: string,
  onStage?: StageCallback,
): Promise<void> {
  const fileType = getFileType(item.name);
  const stage = (key: UploadStageKey, status: UploadStageStatus) => {
    onStage?.(item.id, key, status);
  };

  // ── Stage: Upload ─────────────────────────────────────────────────────
  stage("upload", "running");
  onProgress(item.id, 10, "uploading");
  stage("upload", "done");
  onProgress(item.id, 20, "uploading");

  // ── Stage: OCR / Extraction ───────────────────────────────────────────
  stage("ocr", "running");
  onProgress(item.id, 30, "processing");

  let rawText = "";
  let pageCount = 1;

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
      } else if (fileType === "docx") {
        rawText = await extractTextFromDocx(item.file);
      }
    } catch (err) {
      console.error("[documentService] Extraction error:", err);
      rawText = "";
    }
  }

  stage("ocr", isTextMeaningful(rawText) ? "done" : "error");
  onProgress(item.id, 45, "processing");

  // ── Stage: Classify ───────────────────────────────────────────────────
  stage("classify", "running");
  const effectiveText = isTextMeaningful(rawText) ? rawText : item.name;
  const regexResult = parseExtractedText(effectiveText, item.name);
  stage("classify", "done");
  onProgress(item.id, 55, "processing");

  // ── Stage: Extract (AI) ───────────────────────────────────────────────
  stage("extract", "running");
  let aiResult: Record<string, unknown> | null = null;

  if (isTextMeaningful(rawText)) {
    try {
      const res = await fetch("/api/documents/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText.slice(0, 12000),
          filename: item.name,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as Record<string, unknown>;
        if (!json.error) aiResult = json;
      }
    } catch (err) {
      console.warn("[documentService] AI parse failed:", err);
    }
  }

  const parseResult = mergeParseResults(regexResult, aiResult);
  stage("extract", parseResult.extractedFields.length > 0 ? "done" : "error");
  onProgress(item.id, 68, "processing");

  // ── Stage: Validate ───────────────────────────────────────────────────
  stage("validate", "running");
  // Validate: remove fields with no value, dedup by label
  const validatedFields = parseResult.extractedFields
    .filter((f) => f.value && f.value.trim().length > 0)
    .reduce<typeof parseResult.extractedFields>((acc, f) => {
      if (!acc.find((x) => x.label.toLowerCase() === f.label.toLowerCase()))
        acc.push(f);
      return acc;
    }, []);
  parseResult.extractedFields = validatedFields;
  stage("validate", "done");
  onProgress(item.id, 78, "processing");

  // ── Stage: Chunk ──────────────────────────────────────────────────────
  stage("chunk", "running");
  onProgress(item.id, 85, "processing");

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

  stage("chunk", "done");

  // ── Stage: Index ──────────────────────────────────────────────────────
  stage("index", "running");
  onProgress(item.id, 93, "processing");

  if (isTextMeaningful(rawText)) {
    try {
      const [{ chunkText }, { addChunks }] = await Promise.all([
        import("@/lib/chunker"),
        import("@/lib/ragStore"),
      ]);
      const chunks = chunkText(rawText, docId, item.name, parseResult.category);
      if (chunks.length > 0) addChunks(docId, chunks, userId);
    } catch (err) {
      console.warn("[documentService] Indexing failed:", err);
    }
  }

  stage("index", "done");
  onProgress(item.id, 100, "completed");

  _addDocumentToStore(completedDoc);
  onComplete(item.id, completedDoc);
}
