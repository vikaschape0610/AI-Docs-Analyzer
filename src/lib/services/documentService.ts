// ─── Document Service (Real Client-Side Extraction) ──────────────────────
// Extracts actual text from uploaded PDF files using pdf.js,
// then parses key-value fields with the text intelligence engine.
//
// BACKEND INTEGRATION: Replace extractTextFromPDF with your API call:
//   const res = await fetch('/api/documents/extract', {
//     method: 'POST', body: formData
//   })
//   return res.json() as Promise<ParseResult>

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

// ─── Simulated network delay ──────────────────────────────────────────────
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Interface contract ───────────────────────────────────────────────────
export interface IDocumentService {
  getDocuments(): Promise<Document[]>;
  getDocumentById(id: string): Promise<Document | null>;
  uploadDocument(file: File): Promise<UploadResult>;
  deleteDocument(id: string): Promise<void>;
}

// ─── In-memory store ──────────────────────────────────────────────────────
let _documents: Document[] = [];

// ─── Service Implementation ───────────────────────────────────────────────
export const documentService: IDocumentService = {
  async getDocuments(): Promise<Document[]> {
    await delay(300);
    return [..._documents];
  },

  async getDocumentById(id: string): Promise<Document | null> {
    await delay(200);
    return _documents.find((d) => d.id === id) ?? null;
  },

  async uploadDocument(file: File): Promise<UploadResult> {
    await delay(500);
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    return { documentId: id, status: "queued" };
  },

  async deleteDocument(id: string): Promise<void> {
    await delay(200);
    _documents = _documents.filter((d) => d.id !== id);
  },
};

// ─── Internal helper ──────────────────────────────────────────────────────
export function _addDocumentToStore(doc: Document): void {
  // Prevent duplicate IDs
  _documents = [doc, ..._documents.filter((d) => d.id !== doc.id)];
}

// ─── Determine file type from filename ────────────────────────────────────
function getFileType(filename: string): Document["fileType"] {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.match(/\.(jpg|jpeg|png|webp|gif)$/)) return "image";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "docx";
  return "other";
}

// ─── Upload progress + real extraction ───────────────────────────────────
export async function simulateUploadProgress(
  item: UploadQueueItem,
  onProgress: (id: string, progress: number, status: UploadStatus) => void,
  onComplete: (id: string, doc?: Document) => void,
  userId?: string,
): Promise<void> {
  const fileType = getFileType(item.name);

  // ── Phase 1: Uploading (0→55%) ─────────────────────────────────────────
  onProgress(item.id, 20, "uploading");
  await delay(600);
  onProgress(item.id, 55, "uploading");
  await delay(500);

  // ── Phase 2: Processing / Extracting (55→80%) ──────────────────────────
  onProgress(item.id, 70, "processing");

  let rawText = "";
  let pageCount = 1;

  if (item.file) {
    try {
      if (fileType === "pdf") {
        const [text, count] = await Promise.all([
          extractTextFromPDF(item.file),
          getPDFPageCount(item.file)
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
        rawText = `${item.name} unsupported file type`;
      }
    } catch (err) {
      console.warn("Document extraction failed:", err);
      rawText = item.name;
    }
  }

  onProgress(item.id, 90, "processing");
  await delay(400);

  // ── Phase 3: Intelligence parsing ─────────────────────────────────────
  const effectiveText = rawText.trim().length > 0 ? rawText : item.name;
  let parseResult;
  try {
    const res = await fetch("/api/documents/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        text: effectiveText, 
        filename: item.name
      })
    });
    if (!res.ok) throw new Error("Parse failed");
    const json = await res.json();
    
    // Merge AI response with local mapping for colors/emojis
    const fallback = parseExtractedText(effectiveText, item.name);
    parseResult = {
      ...fallback,
      ...json,
      thumbnailColor: fallback.thumbnailColor,
      thumbnailEmoji: fallback.thumbnailEmoji,
    };
  } catch(e) {
    console.warn("AI parsing failed, falling back to local regex:", e);
    parseResult = parseExtractedText(effectiveText, item.name);
  }
  
  onProgress(item.id, 100, "completed");
  await delay(300);

  // ── Build Document record from real extracted data ────────────────────
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
    rawText: effectiveText,
    userId: userId ?? undefined,
  };

  // ── Phase 4: Chunk + index for RAG ────────────────────────────────────
  // Dynamic import avoids SSR issues (ragStore is client-only)
  try {
    const [{ chunkText }, { addChunks }] = await Promise.all([
      import("@/lib/chunker"),
      import("@/lib/ragStore"),
    ]);
    const chunks = chunkText(
      effectiveText,
      docId,
      item.name,
      parseResult.category,
    );
    if (chunks.length > 0) {
      addChunks(docId, chunks, userId);
    }
  } catch (err) {
    console.warn("[documentService] Chunking failed:", err);
  }

  _addDocumentToStore(completedDoc);
  onComplete(item.id, completedDoc);
}
