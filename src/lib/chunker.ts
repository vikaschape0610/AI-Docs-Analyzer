// ─── DocMind AI — Text Chunking Engine ───────────────────────────────────
// Splits extracted raw text into overlapping chunks for RAG retrieval.
//
// Improvements over v1:
//   - Normalizes text (Aadhaar/Aadhar variants) at index time so BM25
//     query normalization and stored chunk text always agree
//   - Field-aware chunking: preserves key:value blocks together
//   - Larger minimum chunk size to avoid trivial fragments
//   - Page blocks still preserved for source citation accuracy

import type { Chunk, DocumentCategory } from "@/lib/types";

const CHUNK_SIZE = 800; // characters per chunk
const CHUNK_OVERLAP = 150; // overlap between consecutive chunks
const MIN_CHUNK_LENGTH = 40;

// ─── Alias normalization — must mirror chatService ALIAS_MAP ──────────────
// Applied at index time so stored chunks use canonical spellings.
const INDEX_ALIASES: [RegExp, string][] = [
  [/\baadhar(?:r|aa)?\b/gi, "aadhaar"],
  [/\badhar\b/gi, "aadhaar"],
  [/\bpan\s+card\b/gi, "pan"],
  [/\bmark\s+sheet\b/gi, "marksheet"],
  [/\bmarks\s+sheet\b/gi, "marksheet"],
  [/\bresult\s+sheet\b/gi, "marksheet"],
  [/\bcurriculum\s+vitae\b/gi, "resume"],
  [/\b(my\s+)?cv\b/gi, "resume"],
  [/\bidentity\s+card\b/gi, "id card"],
  [/\broll\s+no\b/gi, "roll number"],
  [/\benrollment\s+no\b/gi, "enrollment number"],
];

function normalizeForIndex(text: string): string {
  let t = text;
  for (const [pattern, replacement] of INDEX_ALIASES) {
    t = t.replace(pattern, replacement);
  }
  return t;
}

// ─── Parse page number from page markers injected by pdfExtractor ─────────
function parsePageBlocks(rawText: string): { page: number; text: string }[] {
  const pagePattern = /---\s*Page\s*(\d+)\s*---/gi;
  const blocks: { page: number; text: string }[] = [];
  const parts = rawText.split(pagePattern);

  if (parts.length <= 1) {
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
    .replace(/[ \t]{2,}/g, " ") // collapse horizontal whitespace
    .replace(/\n{3,}/g, "\n\n") // max 2 consecutive newlines
    .replace(/[^\x20-\x7E\n\u00A0-\u024F\u0900-\u097F\u0966-\u096F]/g, " ") // printable + Hindi chars
    .trim();
}

// ─── Field-aware splitting ────────────────────────────────────────────────
// Detects key:value lines and tries to keep them in the same chunk.
// Falls back to sentence/word boundary splitting when no key:value pattern.
function isKeyValueLine(line: string): boolean {
  return /^[A-Za-z\s\/().']{3,40}:\s*.+$/.test(line.trim());
}

function splitIntoChunks(text: string): string[] {
  const lines = text.split("\n");
  const chunks: string[] = [];
  let buffer = "";

  const flushBuffer = () => {
    const trimmed = buffer.trim();
    if (trimmed.length >= MIN_CHUNK_LENGTH) {
      chunks.push(trimmed);
    }
    buffer = "";
  };

  // Group consecutive key:value lines together; split prose at sentence/word boundaries
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    buffer += (buffer ? "\n" : "") + line;

    // If buffer is large enough, find a good break point
    if (buffer.length >= CHUNK_SIZE) {
      // Try to break at a sentence boundary first
      const lastPeriod = buffer.lastIndexOf(". ");
      const lastNewline = buffer.lastIndexOf("\n");
      const breakAt = Math.max(lastPeriod, lastNewline);

      if (breakAt > CHUNK_SIZE * 0.5) {
        // Keep overlap: carry last CHUNK_OVERLAP chars into next chunk
        const main = buffer.slice(0, breakAt + 1).trim();
        const overlap = buffer.slice(Math.max(0, breakAt + 1 - CHUNK_OVERLAP));
        if (main.length >= MIN_CHUNK_LENGTH) chunks.push(main);
        buffer = overlap.trim();
      } else {
        // No good break — hard split at word boundary
        const lastSpace = buffer.lastIndexOf(" ");
        if (lastSpace > CHUNK_SIZE * 0.5) {
          const main = buffer.slice(0, lastSpace).trim();
          const overlap = buffer.slice(Math.max(0, lastSpace - CHUNK_OVERLAP));
          if (main.length >= MIN_CHUNK_LENGTH) chunks.push(main);
          buffer = overlap.trim();
        } else {
          flushBuffer();
        }
      }
    }

    // Force flush between non-key:value and key:value transitions
    // to avoid mixing prose paragraphs and structured fields in one chunk
    const nextLine = lines[i + 1] ?? "";
    const currIsKV = isKeyValueLine(line);
    const nextIsKV = isKeyValueLine(nextLine);
    if (currIsKV !== nextIsKV && buffer.length > MIN_CHUNK_LENGTH * 2) {
      flushBuffer();
    }
  }

  flushBuffer();

  // Final fallback: if no chunks produced, split naively
  if (chunks.length === 0 && text.trim().length >= MIN_CHUNK_LENGTH) {
    chunks.push(text.trim().slice(0, CHUNK_SIZE));
  }

  return chunks;
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * Chunks raw extracted text into overlapping Chunk objects ready for RAG.
 * Applies index-time normalization so stored text matches normalized queries.
 */
export function chunkText(
  rawText: string,
  documentId: string,
  documentName: string,
  category: DocumentCategory,
): Chunk[] {
  const cleaned = cleanText(rawText);
  if (!cleaned || cleaned.length < 10) return [];

  // Normalize aliases at index time
  const normalized = normalizeForIndex(cleaned);

  const pageBlocks = parsePageBlocks(normalized);
  const chunks: Chunk[] = [];
  let globalIndex = 0;

  for (const block of pageBlocks) {
    const pageChunks = splitIntoChunks(block.text);
    for (const chunkTextContent of pageChunks) {
      chunks.push({
        id: `${documentId}-chunk-${globalIndex}`,
        documentId,
        documentName,
        category,
        pageNum: block.page,
        chunkIndex: globalIndex,
        text: chunkTextContent,
      });
      globalIndex++;
    }
  }

  return chunks;
}
