// ─── DocMind AI — Chat Service ────────────────────────────────────────────
//
// PHILOSOPHY: Since Groq now extracts fields with free-form labels in any
// language, hardcoded label matching like "CRN / Roll No" or "Annual Income"
// breaks when Groq returns "Name of Applicant" or "वार्षिक उत्पन्न".
//
// New approach — SEMANTIC field intent detection:
//   - Score every extracted field label against the user query
//   - Token overlap + semantic expansion handles label variations
//   - Works regardless of what label Groq chose or what language it used

import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  Document,
  DocumentReference,
  ExtractedField,
  ExtractedFieldHit,
} from "@/lib/types";

// ─── Alias normalization ───────────────────────────────────────────────────
const ALIAS_MAP: [RegExp, string][] = [
  [/\baadhar(?:r|aa)?\b/gi, "aadhaar"],
  [/\badhar\b/gi, "aadhaar"],
  [/\bpan\s+card\b/gi, "pan card"],
  [/\bmark\s+sheet\b/gi, "marksheet"],
  [/\bmarks\s+sheet\b/gi, "marksheet"],
  [/\bresult\s+sheet\b/gi, "marksheet"],
  [/\bcurriculum\s+vitae\b/gi, "resume"],
  [/\b(my\s+)?cv\b/gi, "resume"],
  [/\bidentity\s+card\b/gi, "id card"],
  [/\broll\s+no\b/gi, "roll number"],
  [/\benrollment\s+no\b/gi, "enrollment number"],
];

export function normalizeQuery(query: string): string {
  let q = query;
  for (const [pattern, replacement] of ALIAS_MAP) {
    q = q.replace(pattern, replacement);
  }
  return q;
}

// ─── Greeting detection ────────────────────────────────────────────────────
const GREETING_PATTERNS = [
  /^h(i|ello|ey)\b/i,
  /^good\s+(morning|afternoon|evening|night|day)\b/i,
  /^thank(s| you)\b/i,
  /^bye\b/i,
  /^goodbye\b/i,
  /^how are you\b/i,
  /^what('s| is) up\b/i,
  /^greetings\b/i,
  /^sup\b/i,
  /^howdy\b/i,
];

function isGreeting(query: string): boolean {
  return GREETING_PATTERNS.some((p) => p.test(query.toLowerCase().trim()));
}

// ─── Semantic field intent detection ──────────────────────────────────────
// Scores every extracted field label against the user query using token
// overlap + semantic expansion. Works with ANY label in ANY language.

const FIELD_QUERY_STOP_WORDS = new Set([
  "what",
  "is",
  "my",
  "the",
  "a",
  "an",
  "of",
  "in",
  "on",
  "at",
  "for",
  "to",
  "and",
  "or",
  "tell",
  "me",
  "show",
  "give",
  "find",
  "get",
  "your",
  "their",
  "his",
  "her",
  "its",
  "please",
  "can",
  "you",
  "i",
  "we",
  "do",
  "does",
  "has",
  "have",
  "are",
  "was",
  "were",
  "whats",
  "hows",
  "which",
  "when",
  "where",
  "document",
  "from",
]);

function tokenizeForIntent(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !FIELD_QUERY_STOP_WORDS.has(t));
}

// Semantic expansions: related terms that should match together
const SEMANTIC_EXPANSIONS: Record<string, string[]> = {
  income: ["annual", "income", "salary", "earning", "yearly", "applicant"],
  salary: ["ctc", "salary", "income", "package", "compensation"],
  aadhaar: ["aadhaar", "uid", "unique", "identification", "aadhar"],
  pan: ["pan", "permanent", "account"],
  cgpa: ["cgpa", "cumulative", "gpa", "grade", "pointer"],
  sgpa: ["sgpa", "semester", "gpa", "grade"],
  percentage: ["percentage", "percent", "marks", "score"],
  dob: ["birth", "born", "dob", "date"],
  birth: ["birth", "born", "dob", "date"],
  roll: ["roll", "seat", "enrollment", "crn", "number"],
  crn: ["crn", "roll", "seat", "enrollment"],
  branch: ["branch", "department", "dept", "stream"],
  department: ["branch", "department", "dept"],
  passport: ["passport", "travel"],
  account: ["account", "number", "bank"],
  ifsc: ["ifsc", "code", "bank"],
  ctc: ["ctc", "salary", "package", "compensation"],
  designation: ["designation", "position", "title", "role"],
  course: ["course", "training", "program", "certification", "certificate"],
  issued: ["issued", "date", "issue", "authority"],
  validity: ["valid", "validity", "expiry", "expire"],
  name: ["name", "applicant", "candidate", "holder", "student"],
  address: ["address", "residence", "location", "place"],
  certificate: ["certificate", "number", "cert", "id"],
  financial: ["financial", "year", "period", "assessment"],
  tahsil: ["tahsil", "tehsil", "office", "authority"],
  district: ["district", "location", "place"],
  state: ["state", "government", "shasan"],
};

function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set(tokens);
  for (const token of tokens) {
    const extras = SEMANTIC_EXPANSIONS[token] ?? [];
    for (const e of extras) expanded.add(e);
  }
  return expanded;
}

function scoreFieldMatch(
  fieldLabel: string,
  queryTokens: string[],
  expandedQuery: Set<string>,
): number {
  const labelTokens = tokenizeForIntent(fieldLabel);
  if (labelTokens.length === 0) return 0;

  let score = 0;
  for (const lt of labelTokens) {
    if (expandedQuery.has(lt)) score += 1.0;
    for (const qt of queryTokens) {
      if (qt.length > 3 && lt.includes(qt)) score += 0.5;
      if (lt.length > 3 && qt.includes(lt)) score += 0.5;
    }
  }
  return score;
}

function detectFieldQueryIntent(
  normalizedQuery: string,
  documents: Document[],
): { hit: ExtractedFieldHit | null } | null {
  const queryTokens = tokenizeForIntent(normalizedQuery);
  if (queryTokens.length === 0) return null;

  const expandedQuery = expandTokens(queryTokens);

  let bestScore = 0;
  let bestHit: ExtractedFieldHit | null = null;
  const MIN_SCORE = 0.8;

  for (const doc of documents) {
    if (!doc.extractedInfo || doc.extractedInfo.length === 0) continue;
    for (const f of doc.extractedInfo as ExtractedField[]) {
      const score = scoreFieldMatch(f.label, queryTokens, expandedQuery);
      if (score > bestScore) {
        bestScore = score;
        bestHit = {
          fieldLabel: f.label,
          fieldValue: f.value,
          documentName: doc.name,
          documentId: doc.id,
          documentType: doc.documentType,
        };
      }
    }
  }

  if (bestScore >= MIN_SCORE && bestHit) return { hit: bestHit };
  return null;
}

// ─── Main response generator ──────────────────────────────────────────────
async function generateResponse(
  request: ChatRequest,
  documents: Document[],
  userId?: string,
): Promise<ChatResponse> {
  const { query, sessionId, documentIds } = request;
  const normalized = normalizeQuery(query);

  const allDocuments: DocumentReference[] = documents.map((doc) => ({
    documentId: doc.id,
    documentName: doc.name,
    category: doc.category,
    sizeLabel: doc.sizeLabel,
    fileType: doc.fileType,
    thumbnailEmoji: doc.thumbnailEmoji,
    thumbnailColor: doc.thumbnailColor,
  }));

  if (isGreeting(query)) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        sessionId,
        totalDocuments: documents.length,
      }),
    });
    return res.json() as Promise<ChatResponse>;
  }

  // Fast path — direct field match
  const fieldResult = detectFieldQueryIntent(normalized, documents);
  if (fieldResult?.hit) {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: normalized,
        sessionId,
        totalDocuments: documents.length,
        extractedFieldHit: fieldResult.hit,
        allDocuments,
      }),
    });
    return res.json() as Promise<ChatResponse>;
  }

  // RAG path
  let chunks: import("@/lib/types").Chunk[] = [];
  if (documents.length > 0) {
    try {
      const { searchChunks } = await import("@/lib/ragStore");
      chunks = searchChunks(normalized, documentIds, 6, userId);
    } catch (err) {
      console.warn("[chatService] ragStore search failed:", err);
    }
  }

  // Pass structured fields to chat route so LLM sees clean data
  const structuredDocs = documents
    .filter((doc) => doc.extractedInfo && doc.extractedInfo.length > 0)
    .map((doc) => ({
      documentName: doc.name,
      documentType: doc.documentType,
      fields: doc.extractedInfo as ExtractedField[],
    }));

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: normalized,
      sessionId,
      documentIds,
      chunks,
      totalDocuments: documents.length,
      allDocuments,
      structuredDocs,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Chat API error ${res.status}: ${errorText}`);
  }

  return res.json() as Promise<ChatResponse>;
}

export function createSession(
  firstMessage?: string,
): import("@/lib/types").ChatSession {
  return {
    id: `session-${Date.now()}`,
    title: firstMessage
      ? firstMessage.slice(0, 40) + (firstMessage.length > 40 ? "..." : "")
      : "New conversation",
    createdAt: new Date().toISOString(),
    messages: [],
  };
}

export const chatService = {
  generateResponse,
};
