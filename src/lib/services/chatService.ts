// ─── DocMind AI — Chat Service (Reasoning Pipeline) ──────────────────────
//
// REASONING PIPELINE — executed before every Groq call:
//
//   Step 1: Understand intent (what doc type + field is the user asking about?)
//   Step 2: Check if the relevant document exists
//           → If NOT: return "doc not found" without calling Groq
//   Step 3: Check if the field exists in that document
//           → If NOT: return "field not found" without calling Groq
//   Step 4: If field found → return it directly (no Groq needed)
//   Step 5: If intent is general → RAG retrieval
//   Step 6: Only then → call Groq with EVIDENCE ONLY

import type {
  ChatRequest,
  ChatResponse,
  Document,
  DocumentReference,
  ExtractedField,
  DocumentType,
  QueryIntent,
} from "@/lib/types";

// ─── Alias normalization ───────────────────────────────────────────────────
const ALIAS_MAP: [RegExp, string][] = [
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
  [/\bdl\b/gi, "driving licence"],
  [/\bdriving\s+license\b/gi, "driving licence"],
  [/\bvoting\s+card\b/gi, "voter id"],
  [/\bvote\s+id\b/gi, "voter id"],
];

export function normalizeQuery(query: string): string {
  let q = query;
  for (const [pattern, replacement] of ALIAS_MAP)
    q = q.replace(pattern, replacement);
  return q;
}

// ─── Intent recognition ────────────────────────────────────────────────────
// Maps user queries to document types and field names
const DOC_TYPE_SIGNALS: { pattern: RegExp; docType: DocumentType }[] = [
  { pattern: /aadhaar|uid\s*number/i, docType: "aadhaar_card" },
  { pattern: /\bpan\b|permanent\s+account/i, docType: "pan_card" },
  { pattern: /passport/i, docType: "passport" },
  {
    pattern: /marksheet|cgpa|sgpa|semester\s+\d|academic\s+result/i,
    docType: "marksheet",
  },
  {
    pattern: /income\s+cert|annual\s+income|उत्पन्न/i,
    docType: "income_certificate",
  },
  { pattern: /caste\s+cert/i, docType: "caste_certificate" },
  {
    pattern: /bank\s+statement|account\s+statement/i,
    docType: "bank_statement",
  },
  { pattern: /offer\s+letter|appointment\s+letter/i, docType: "offer_letter" },
  { pattern: /resume|curriculum\s+vitae/i, docType: "resume" },
  { pattern: /student\s+id|crn\b|college\s+id/i, docType: "student_id" },
  { pattern: /driving\s+licen[sc]e|dl\b/i, docType: "driving_licence" },
  { pattern: /voter\s+id|election\s+card/i, docType: "voter_id" },
  { pattern: /birth\s+cert/i, docType: "birth_certificate" },
];

// Stop words for intent tokenization
const STOP_WORDS = new Set([
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
  "which",
  "when",
  "where",
  "document",
  "from",
  "about",
  "how",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// Semantic expansions for field matching
const FIELD_EXPANSIONS: Record<string, string[]> = {
  aadhaar: ["aadhaar", "uid", "unique", "identification", "aadhar"],
  pan: ["pan", "permanent", "account", "number"],
  name: ["name", "applicant", "candidate", "holder", "student", "person"],
  dob: ["birth", "born", "dob", "date"],
  birth: ["birth", "born", "dob", "date"],
  cgpa: ["cgpa", "cumulative", "gpa", "grade", "pointer"],
  sgpa: ["sgpa", "semester", "gpa", "grade"],
  percentage: ["percentage", "percent", "marks", "score"],
  income: ["income", "annual", "salary", "earning", "yearly", "applicant"],
  salary: ["ctc", "salary", "income", "package", "compensation"],
  roll: ["roll", "seat", "enrollment", "crn"],
  crn: ["crn", "roll", "seat", "enrollment"],
  branch: ["branch", "department", "dept", "stream"],
  ifsc: ["ifsc", "code", "bank"],
  account: ["account", "number", "bank"],
  ctc: ["ctc", "salary", "package"],
  designation: ["designation", "position", "title", "role"],
  address: ["address", "residence", "location"],
  certificate: ["certificate", "number", "cert"],
  financial: ["financial", "year", "period"],
  validity: ["valid", "validity", "expiry", "expire"],
  passport: ["passport", "number", "travel"],
};

function expandTokens(tokens: string[]): Set<string> {
  const expanded = new Set(tokens);
  for (const t of tokens) {
    for (const e of FIELD_EXPANSIONS[t] ?? []) expanded.add(e);
  }
  return expanded;
}

function scoreFieldMatch(
  label: string,
  queryTokens: string[],
  expanded: Set<string>,
): number {
  const labelTokens = tokenize(label);
  if (!labelTokens.length) return 0;
  let score = 0;
  for (const lt of labelTokens) {
    if (expanded.has(lt)) score += 1.0;
    for (const qt of queryTokens) {
      if (qt.length > 3 && lt.includes(qt)) score += 0.5;
      if (lt.length > 3 && qt.includes(lt)) score += 0.5;
    }
  }
  return score;
}

// ─── Step 1: Parse query intent ───────────────────────────────────────────
function parseIntent(
  normalizedQuery: string,
  documents: Document[],
): QueryIntent {
  const q = normalizedQuery.toLowerCase();

  // Check if this is a list/summary request
  if (
    /what\s+documents|list\s+my\s+docs|all\s+documents|show\s+docs/i.test(q)
  ) {
    return { type: "list_docs", normalizedQuery };
  }
  if (/summarize|summary\s+of|overview\s+of/i.test(q)) {
    return { type: "summary", normalizedQuery };
  }

  // Detect target doc type
  let targetDocType: DocumentType | undefined;
  for (const { pattern, docType } of DOC_TYPE_SIGNALS) {
    if (pattern.test(q)) {
      targetDocType = docType;
      break;
    }
  }

  // Detect target field
  const queryTokens = tokenize(normalizedQuery);
  const expanded = expandTokens(queryTokens);

  // See if any doc has a field that matches
  let bestFieldScore = 0;
  let targetField: string | undefined;

  for (const doc of documents) {
    if (!doc.extractedInfo) continue;
    for (const f of doc.extractedInfo) {
      const score = scoreFieldMatch(f.label, queryTokens, expanded);
      if (score > bestFieldScore) {
        bestFieldScore = score;
        targetField = f.label;
      }
    }
  }

  if (targetDocType || (targetField && bestFieldScore >= 0.8)) {
    return {
      type: "field_lookup",
      targetDocType,
      targetField,
      normalizedQuery,
    };
  }

  return { type: "general", normalizedQuery };
}

// ─── Step 2–4: Field lookup with grounded reasoning ───────────────────────
interface FieldLookupResult {
  step: "doc_not_found" | "field_not_found" | "field_found";
  hit?: {
    fieldLabel: string;
    fieldValue: string;
    documentName: string;
    documentId: string;
    documentType?: DocumentType;
    confidence?: number;
    page?: number;
  };
  docName?: string;
  fieldName?: string;
  docType?: string;
}

function performFieldLookup(
  intent: QueryIntent,
  documents: Document[],
): FieldLookupResult | null {
  if (intent.type !== "field_lookup") return null;

  const { targetDocType, targetField, normalizedQuery } = intent;

  // If we know the target doc type, check if it exists
  if (targetDocType) {
    const matchingDocs = documents.filter(
      (d) => d.documentType === targetDocType,
    );
    if (matchingDocs.length === 0) {
      return {
        step: "doc_not_found",
        docType: targetDocType.replace(/_/g, " "),
      };
    }

    // Doc exists — look for field
    const queryTokens = tokenize(normalizedQuery);
    const expanded = expandTokens(queryTokens);

    let bestScore = 0;
    let bestHit: FieldLookupResult["hit"];

    for (const doc of matchingDocs) {
      if (!doc.extractedInfo) continue;
      for (const f of doc.extractedInfo) {
        const score = scoreFieldMatch(f.label, queryTokens, expanded);
        if (score > bestScore) {
          bestScore = score;
          bestHit = {
            fieldLabel: f.label,
            fieldValue: f.value,
            documentName: doc.name,
            documentId: doc.id,
            documentType: doc.documentType,
            confidence: f.confidence,
            page: f.page,
          };
        }
      }
    }

    if (bestScore >= 0.8 && bestHit) {
      return { step: "field_found", hit: bestHit };
    }

    // Doc found but field missing
    const fieldName = targetField ?? queryTokens.slice(0, 3).join(" ");
    return {
      step: "field_not_found",
      docName: matchingDocs[0].name,
      fieldName,
    };
  }

  // No specific doc type — do general field search across all docs
  if (targetField) {
    const queryTokens = tokenize(normalizedQuery);
    const expanded = expandTokens(queryTokens);

    let bestScore = 0;
    let bestHit: FieldLookupResult["hit"];

    for (const doc of documents) {
      if (!doc.extractedInfo) continue;
      for (const f of doc.extractedInfo) {
        const score = scoreFieldMatch(f.label, queryTokens, expanded);
        if (score > bestScore) {
          bestScore = score;
          bestHit = {
            fieldLabel: f.label,
            fieldValue: f.value,
            documentName: doc.name,
            documentId: doc.id,
            documentType: doc.documentType,
            confidence: f.confidence,
            page: f.page,
          };
        }
      }
    }

    if (bestScore >= 0.8 && bestHit) {
      return { step: "field_found", hit: bestHit };
    }
  }

  return null;
}

// ─── Main response generator ──────────────────────────────────────────────
async function generateResponse(
  request: ChatRequest,
  documents: Document[],
  userId?: string,
  userName?: string,
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

  // ── Step 1: Parse intent ───────────────────────────────────────────────
  const intent = parseIntent(normalized, documents);

  // ── Steps 2–4: Reasoning pipeline ────────────────────────────────────
  const lookupResult = performFieldLookup(intent, documents);

  if (lookupResult) {
    if (lookupResult.step === "doc_not_found") {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalized,
          sessionId,
          totalDocuments: documents.length,
          userName,
          reasoning: { step: "doc_not_found", docType: lookupResult.docType },
        }),
      });
      return res.json() as Promise<ChatResponse>;
    }

    if (lookupResult.step === "field_not_found") {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalized,
          sessionId,
          totalDocuments: documents.length,
          userName,
          reasoning: {
            step: "field_not_found",
            docName: lookupResult.docName,
            fieldName: lookupResult.fieldName,
          },
        }),
      });
      return res.json() as Promise<ChatResponse>;
    }

    if (lookupResult.step === "field_found" && lookupResult.hit) {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: normalized,
          sessionId,
          totalDocuments: documents.length,
          userName,
          extractedFieldHit: lookupResult.hit,
          allDocuments,
        }),
      });
      return res.json() as Promise<ChatResponse>;
    }
  }

  // ── Step 5: RAG retrieval ─────────────────────────────────────────────
  let chunks: import("@/lib/types").Chunk[] = [];
  if (documents.length > 0) {
    try {
      const { searchChunks } = await import("@/lib/ragStore");
      chunks = searchChunks(normalized, documentIds, 6, userId);
    } catch (err) {
      console.warn("[chatService] RAG search failed:", err);
    }
  }

  // Build structured doc context
  const structuredDocs = documents
    .filter((d) => d.extractedInfo && d.extractedInfo.length > 0)
    .map((d) => ({
      documentName: d.name,
      documentType: d.documentType,
      fields: d.extractedInfo as ExtractedField[],
    }));

  // ── Step 6: Groq with grounded evidence ──────────────────────────────
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
      queryIntent: intent,
      userName,
    }),
  });

  if (!res.ok) throw new Error(`Chat API error ${res.status}`);
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

export const chatService = { generateResponse };
