// ─── DocMind AI — Persistent RAG Store ───────────────────────────────────
// Stores document chunks in localStorage so they survive browser refresh.
// Provides BM25-style keyword retrieval for the chat pipeline.
//
// BACKEND INTEGRATION:
//   Replace this entire module with an API client that calls:
//     POST /api/chunks          → addChunks()
//     GET  /api/chunks/search   → searchChunks()
//     DELETE /api/chunks/:docId → removeDocument()
//   The Chunk interface and function signatures must remain the same.

import type { Chunk } from "@/lib/types";

const STORAGE_KEY_PREFIX = "docmind_chunks_v2";

function storageKey(userId?: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}_${userId}` : STORAGE_KEY_PREFIX;
}

// ─── Persistence helpers ────────────────────────────────────────────────────────────

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

// ─── Per-user in-process cache ───────────────────────────────────────────

// userId -> (docId -> Chunk[])
const _userStores = new Map<string, Map<string, Chunk[]>>();
const ANONYMOUS = "__anon__";

function getStore(userId?: string): Map<string, Chunk[]> {
  const key = userId ?? ANONYMOUS;
  if (!_userStores.has(key)) {
    _userStores.set(key, loadFromStorage(userId));
  }
  return _userStores.get(key)!;
}

// ─── Tokenization + BM25-style scoring ───────────────────────────────────

const STOP_WORDS = new Set([
  "a","an","the","is","it","in","on","at","to","of","and","or","for",
  "my","me","i","you","your","am","are","was","were","be","been","being",
  "have","has","had","do","does","did","not","from","with","this","that",
  "what","which","who","when","where","how","can","could","would","should",
  "will","about","also","from","into","than","then","its","our","their",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s\u0900-\u097F]/g, " ") // keep Hindi chars
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Score a chunk against a query using BM25-inspired term frequency weighting.
 * Higher score = more relevant.
 */
function scoreChunk(chunk: Chunk, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  const chunkText = chunk.text.toLowerCase();
  const chunkTokens = tokenize(chunk.text);
  const chunkLength = chunkTokens.length;
  const avgLen = 60; // average chunk token count (tuned for 800-char chunks)

  const k1 = 1.5;
  const b = 0.75;

  let score = 0;

  for (const qToken of queryTokens) {
    // Term frequency in chunk
    const tf = chunkTokens.filter((t) => t === qToken).length;

    if (tf === 0) {
      // Also check for substring match (handles OCR word splits, partial matches)
      if (chunkText.includes(qToken)) {
        score += 0.5;
      }
      continue;
    }

    // BM25 term score
    const normTf = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (chunkLength / avgLen)));
    score += normTf;
  }

  // Boost score if category keyword appears in chunk
  const categoryTerms = chunk.category.toLowerCase().split(/\s+/);
  for (const ct of categoryTerms) {
    if (chunkText.includes(ct)) score += 0.3;
  }

  // Boost for document name match (user may reference the doc by name)
  const docNameTokens = tokenize(chunk.documentName);
  for (const qt of queryTokens) {
    if (docNameTokens.includes(qt)) score += 0.4;
  }

  return score;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Store chunks for a document. Overwrites any existing chunks for that document.
 */
export function addChunks(documentId: string, chunks: Chunk[], userId?: string): void {
  const store = getStore(userId);
  store.set(documentId, chunks);
  saveToStorage(store, userId);
}

/**
 * Retrieve all chunks, optionally filtered to specific document IDs.
 */
export function getChunksForDocuments(documentIds?: string[], userId?: string): Chunk[] {
  const store = getStore(userId);
  if (!documentIds || documentIds.length === 0) {
    return Array.from(store.values()).flat();
  }
  return documentIds.flatMap((id) => store.get(id) ?? []);
}

/**
 * Remove all chunks for a given document.
 */
export function removeDocument(documentId: string, userId?: string): void {
  const store = getStore(userId);
  store.delete(documentId);
  saveToStorage(store, userId);
}

/**
 * BM25-style semantic search over stored chunks.
 *
 * @param query        The user's query string
 * @param documentIds  Optional: scope search to these docs only
 * @param topK         Number of top chunks to return (default 6)
 * @param userId       Optional: restrict to this user's chunks
 * @returns            Top-K relevant Chunk objects, ordered by score
 */
export function searchChunks(
  query: string,
  documentIds?: string[],
  topK = 6,
  userId?: string
): Chunk[] {
  const candidates = getChunksForDocuments(documentIds, userId);
  if (candidates.length === 0) return [];

  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return candidates.slice(0, topK);

  const scored = candidates
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTokens) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, topK).map((s) => s.chunk);
}

/**
 * Return how many chunks are stored for a document.
 */
export function getChunkCount(documentId: string, userId?: string): number {
  const store = getStore(userId);
  return (store.get(documentId) ?? []).length;
}

/**
 * Clear all stored chunks for a specific user (or all if no userId).
 */
export function clearAllChunks(userId?: string): void {
  if (userId) {
    _userStores.set(userId, new Map());
    if (typeof window !== "undefined") {
      localStorage.removeItem(storageKey(userId));
    }
  } else {
    _userStores.clear();
    if (typeof window !== "undefined") {
      // Clear all user-scoped keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(STORAGE_KEY_PREFIX)) keysToRemove.push(k);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
  }
}
