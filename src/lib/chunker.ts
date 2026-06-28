// ─── DocMind AI — Text Chunking Engine ───────────────────────────────────
// Splits extracted raw text into overlapping chunks for RAG retrieval.
// Runs client-side after extraction. No dependencies.
//
// BACKEND INTEGRATION: Replace this module with a server-side chunking
// endpoint that uses LangChain RecursiveCharacterTextSplitter or similar.
// The Chunk interface in types.ts must remain the same.

import type { Chunk, DocumentCategory } from "@/lib/types";

const CHUNK_SIZE = 800;    // characters per chunk
const CHUNK_OVERLAP = 150; // overlap between consecutive chunks

// ─── Parse page number from page markers injected by pdfExtractor ─────────
// pdfExtractor wraps each page as: "--- Page N ---\n<text>"
function parsePageBlocks(rawText: string): { page: number; text: string }[] {
  const pagePattern = /---\s*Page\s*(\d+)\s*---/gi;
  const blocks: { page: number; text: string }[] = [];
  const parts = rawText.split(pagePattern);

  // parts = ["", "1", "<page1 text>", "2", "<page2 text>", ...]
  if (parts.length <= 1) {
    // No page markers (image / docx) — treat as single page
    return [{ page: 1, text: rawText.trim() }];
  }

  for (let i = 1; i < parts.length; i += 2) {
    const pageNum = parseInt(parts[i], 10);
    const text = (parts[i + 1] ?? "").trim();
    if (text.length > 0) {
      blocks.push({ page: pageNum, text });
    }
  }

  return blocks.length > 0 ? blocks : [{ page: 1, text: rawText.trim() }];
}

// ─── Clean extracted text ─────────────────────────────────────────────────
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]{2,}/g, " ")     // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n")     // max 2 consecutive newlines
    .replace(/[^\x20-\x7E\n\u00A0-\u024F\u0900-\u097F]/g, " ") // keep printable + Hindi chars
    .trim();
}

// ─── Split a single page's text into overlapping chunks ───────────────────
function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + CHUNK_SIZE;
    let chunk = text.slice(start, end);

    // If not at end, try to break at sentence/word boundary
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf(". ");
      const lastNewline = chunk.lastIndexOf("\n");
      const breakAt = Math.max(lastPeriod, lastNewline);

      if (breakAt > CHUNK_SIZE * 0.6) {
        // Good breakpoint found — use it
        chunk = text.slice(start, start + breakAt + 1);
        start = start + breakAt + 1 - CHUNK_OVERLAP;
      } else {
        // No good breakpoint — break at word boundary
        const lastSpace = chunk.lastIndexOf(" ");
        if (lastSpace > CHUNK_SIZE * 0.6) {
          chunk = text.slice(start, start + lastSpace);
          start = start + lastSpace - CHUNK_OVERLAP;
        } else {
          start = end - CHUNK_OVERLAP;
        }
      }
    } else {
      start = end; // last chunk
    }

    const trimmed = chunk.trim();
    if (trimmed.length > 30) { // skip trivially short chunks
      chunks.push(trimmed);
    }
  }

  return chunks;
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Chunks raw extracted text into overlapping Chunk objects ready for RAG.
 *
 * @param rawText    Full text extracted from the document
 * @param documentId The document's ID
 * @param documentName The document's filename
 * @param category   The detected document category
 * @returns          Array of Chunk objects
 */
export function chunkText(
  rawText: string,
  documentId: string,
  documentName: string,
  category: DocumentCategory
): Chunk[] {
  const cleaned = cleanText(rawText);
  if (!cleaned || cleaned.length < 10) return [];

  const pageBlocks = parsePageBlocks(cleaned);
  const chunks: Chunk[] = [];
  let globalIndex = 0;

  for (const block of pageBlocks) {
    const pageChunks = splitIntoChunks(block.text);
    for (const chunkText of pageChunks) {
      chunks.push({
        id: `${documentId}-chunk-${globalIndex}`,
        documentId,
        documentName,
        category,
        pageNum: block.page,
        chunkIndex: globalIndex,
        text: chunkText,
      });
      globalIndex++;
    }
  }

  return chunks;
}
