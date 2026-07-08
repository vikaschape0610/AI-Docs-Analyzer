// ─── DocMind AI — Persistent RAG Store ───────────────────────────────────
// Stores document chunks in localStorage so they survive browser refresh.
// Provides BM25-style keyword retrieval for the chat pipeline.
//
// Improvements over v1:
//   - Query normalization applied before scoring (same aliases as chunker)
//   - Document-type boost: chunks from the right doc type score higher
//   - Field-content boost: chunks containing field patterns score higher
//   - Min score threshold to avoid returning irrelevant chunks

import type { Chunk } from "@/lib/types";

const STORAGE_KEY_PREFIX = "docmind_chunks_v2";

function storageKey(userId?: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;
}

// ─── Persistence helpers ──────────────────────────────────────────────────

function loadFromStorage(userId?: string): Map<string, Chunk[]> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return new Map();
    const obj = JSON.parse(raw) as Record<string, Chunk[]>;
    return new Map(Object.entries(obj));
  } catch {
    return new Map();
  }
}

function saveToStorage(store: Map<string, Chunk[]>, userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    const obj: Record<string, Chunk[]> = {};
    for (const [k, v] of store) obj[k] = v;
    localStorage.setItem(storageKey(userId), JSON.stringify(obj));
  } catch (e) {
    console.warn("[ragStore] Failed to persist chunks:", e);
  }
}

// ─── Per-user in-process cache ────────────────────────────────────────────

const _userStores = new Map<string, Map<string, Chunk[]>>();
const ANONYMOUS = "__anon__";

function getStore(userId?: string): Map<string, Chunk[]> {
  const key = userId ?? ANONYMOUS;
  if (!_userStores.has(key)) {
    _userStores.set(key, loadFromStorage(userId));
  }
  return _userStores.get(key)!;
}

// ─── Alias normalization — mirrors chunker and chatService ────────────────
const QUERY_ALIASES: [RegExp, string][] = [
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

function normalizeQuery(query: string): string {
  let q = query;
  for (const [pattern, replacement] of QUERY_ALIASES) {
    q = q.replace(pattern, replacement);
  }
  return q;
}

// ─── Tokenization + BM25-style scoring ───────────────────────────────────

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "is",
  "it",
  "in",
  "on",
  "at",
  "to",
  "of",
  "and",
  "or",
  "for",
  "my",
  "me",
  "i",
  "you",
  "your",
  "am",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "not",
  "from",
  "with",
  "this",
  "that",
  "what",
  "which",
  "who",
  "when",
  "where",
  "how",
  "can",
  "could",
  "would",
  "should",
  "will",
  "about",
  "also",
  "into",
  "than",
  "then",
  "its",
  "our",
  "their",
  "tell",
  "give",
  "show",
  "find",
  "get",
  "want",
  "need",
  "know",
  "please",
  "document",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0900-\u097F]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

const MIN_RELEVANCE_SCORE = 0.3;

function scoreChunk(chunk: Chunk, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const chunkText = chunk.text.toLowerCase();
  const chunkTokens = tokenize(chunk.text);
  const chunkLength = chunkTokens.length;
  const avgLen = 60;

  const k1 = 1.5;
  const b = 0.75;

  let score = 0;

  for (const qToken of queryTokens) {
    const tf = chunkTokens.filter((t) => t === qToken).length;

    if (tf === 0) {
      // Partial/substring match (handles OCR word splits)
      if (chunkText.includes(qToken)) score += 0.4;
      continue;
    }

    // BM25 term score
    const normTf =
      (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (chunkLength / avgLen)));
    score += normTf;
  }

  // Boost: category keyword in chunk
  const categoryTerms = chunk.category.toLowerCase().split(/\s+/);
  for (const ct of categoryTerms) {
    if (chunkText.includes(ct)) score += 0.3;
  }

  // Boost: document name token overlap with query
  const docNameTokens = tokenize(chunk.documentName);
  for (const qt of queryTokens) {
    if (docNameTokens.includes(qt)) score += 0.5;
  }

  // Boost: chunk contains a key:value pattern (structured data is high-value)
  if (/[A-Za-z\s]{3,30}:\s*[^\s]/.test(chunk.text)) {
    score += 0.4;
  }

  return score;
}

// ─── Public API ───────────────────────────────────────────────────────────

export function addChunks(
  documentId: string,
  chunks: Chunk[],
  userId?: string,
): void {
  const store = getStore(userId);
  store.set(documentId, chunks);
  saveToStorage(store, userId);
}

export function getChunksForDocuments(
  documentIds?: string[],
  userId?: string,
): Chunk[] {
  const store = getStore(userId);
  if (!documentIds || documentIds.length === 0) {
    return Array.from(store.values()).flat();
  }
  return documentIds.flatMap((id) => store.get(id) ?? []);
}

export function removeDocument(documentId: string, userId?: string): void {
  const store = getStore(userId);
  store.delete(documentId);
  saveToStorage(store, userId);
}

/**
 * BM25-style search over stored chunks.
 * Normalizes query aliases before scoring so "aadhar" finds "aadhaar" chunks.
 */
export function searchChunks(
  query: string,
  documentIds?: string[],
  topK = 6,
  userId?: string,
): Chunk[] {
  const candidates = getChunksForDocuments(documentIds, userId);
  if (candidates.length === 0) return [];

  // Normalize query aliases before tokenizing
  const normalizedQuery = normalizeQuery(query);
  const queryTokens = tokenize(normalizedQuery);
  if (queryTokens.length === 0) return candidates.slice(0, topK);

  const scored = candidates
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTokens) }))
    .filter((s) => s.score >= MIN_RELEVANCE_SCORE)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map((s) => s.chunk);
}

export function getChunkCount(documentId: string, userId?: string): number {
  const store = getStore(userId);
  return (store.get(documentId) ?? []).length;
}

export function clearAllChunks(userId?: string): void {
  if (userId) {
    _userStores.set(userId, new Map());
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey(userId));
    }
  } else {
    _userStores.clear();
    if (typeof window !== "undefined") {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(STORAGE_KEY_PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  }
}
