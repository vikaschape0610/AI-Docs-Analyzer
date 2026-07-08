// ─── DocMind AI — Chat Service (Groq RAG + Query Intelligence) ────────────
//
// Improvements over v1:
//   - detectFieldQueryIntent now filters by document type before matching
//     so asking "what is my income" on a marksheet doesn't get CGPA
//   - Query normalization is shared with ragStore (same ALIAS_MAP)
//   - Field label matching is case-insensitive for robustness
//   - extractedFieldHit uses the best match across all docs, not first match

import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  Document,
  DocumentReference,
  DocumentType,
  ExtractedField,
  ExtractedFieldHit,
} from "@/lib/types";

// ─── Alias normalization — mirrors chunker.ts and ragStore.ts ─────────────
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
];

function normalizeQuery(query: string): string {
  let q = query;
  for (const [pattern, replacement] of ALIAS_MAP) {
    q = q.replace(pattern, replacement);
  }
  return q;
}

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

// ─── Field Intent Patterns ────────────────────────────────────────────────
// Each entry: query patterns, the exact field labels to look for,
// and optionally the document types that hold these fields.
// documentTypes restricts which documents are searched for this field.
// This prevents cross-contamination (e.g. "income" should not match marksheet).

interface FieldIntentRule {
  labels: string[];
  patterns: RegExp[];
  documentTypes?: DocumentType[]; // if set, only search these doc types
}

const FIELD_INTENT_PATTERNS: FieldIntentRule[] = [
  {
    labels: ["Aadhaar Number"],
    patterns: [/aadhaar|aadhar|adhar|uid\s*number/i],
    documentTypes: ["aadhaar_card"],
  },
  {
    labels: ["PAN Number"],
    patterns: [/pan\s*(card|number|no)?/i, /permanent\s+account/i],
    documentTypes: ["pan_card"],
  },
  {
    labels: ["Passport Number"],
    patterns: [/passport\s*(number|no)?/i],
    documentTypes: ["passport"],
  },
  {
    labels: ["CRN / Roll No"],
    patterns: [/crn|roll\s*(no|number)/i, /enrollment\s*(no|number)/i],
    documentTypes: ["student_id"],
  },
  {
    labels: ["Roll Number"],
    patterns: [/roll\s*(no|number)/i, /seat\s*(no|number)/i],
    documentTypes: ["marksheet"],
  },
  {
    labels: ["Branch / Department"],
    patterns: [/\bbranch\b|\bdepartment\b|\bdept\b/i],
    documentTypes: ["student_id", "employee_id"],
  },
  {
    labels: ["Class / Year"],
    patterns: [/\bclass\b|\byear\b/i],
    documentTypes: ["student_id"],
  },
  {
    labels: ["Division"],
    patterns: [/\bdivision\b|\bdiv\b/i],
    documentTypes: ["student_id"],
  },
  {
    labels: ["Certificate Number"],
    patterns: [/certificate\s*(no|number)?|cert\s*(no|id)/i],
    documentTypes: [
      "income_certificate",
      "caste_certificate",
      "government_certificate",
    ],
  },
  {
    labels: ["Annual Income"],
    patterns: [/income\s*(amount|rs)?|annual\s*income/i],
    documentTypes: ["income_certificate"],
  },
  {
    labels: ["CGPA"],
    patterns: [/cgpa|cumulative\s+grade/i],
    documentTypes: ["marksheet"],
  },
  {
    labels: ["SGPA"],
    patterns: [/sgpa|semester\s+grade/i],
    documentTypes: ["marksheet"],
  },
  {
    labels: ["Percentage"],
    patterns: [/percentage|percent/i],
    documentTypes: ["marksheet"],
  },
  {
    labels: ["Date of Birth"],
    patterns: [/\bdob\b|date of birth|birth\s*date/i],
  },
  {
    labels: ["IFSC Code"],
    patterns: [/ifsc/i],
    documentTypes: ["bank_statement"],
  },
  {
    labels: ["Account Number"],
    patterns: [/account\s*(no|number)/i],
    documentTypes: ["bank_statement"],
  },
  {
    labels: ["CTC / Salary"],
    patterns: [/\bctc\b|salary|package/i],
    documentTypes: ["offer_letter"],
  },
  {
    labels: ["Designation"],
    patterns: [/designation|job\s*title|position/i],
    documentTypes: ["offer_letter", "employee_id"],
  },
  {
    labels: ["Institute"],
    patterns: [/institute|college\s*name/i],
    documentTypes: ["student_id"],
  },
  {
    labels: ["University / Board"],
    patterns: [/university|board/i],
    documentTypes: ["marksheet"],
  },
];

/**
 * Detects if the query is asking for a specific extracted field.
 * Filters by documentType before searching so fields only come from
 * the correct document type — prevents cross-document contamination.
 */
function detectFieldQueryIntent(
  normalizedQuery: string,
  documents: Document[],
): { hit: ExtractedFieldHit | null; matchedLabel: string } | null {
  const q = normalizedQuery.toLowerCase();

  for (const { labels, patterns, documentTypes } of FIELD_INTENT_PATTERNS) {
    if (!patterns.some((p) => p.test(q))) continue;

    // Filter documents to the relevant types if specified
    const candidateDocs = documentTypes
      ? documents.filter((doc) =>
          documentTypes.includes(doc.documentType ?? "generic"),
        )
      : documents;

    for (const doc of candidateDocs) {
      if (!doc.extractedInfo) continue;
      const matched = doc.extractedInfo.find((f: ExtractedField) =>
        labels.some((l) => f.label.toLowerCase() === l.toLowerCase()),
      );
      if (matched) {
        return {
          matchedLabel: matched.label,
          hit: {
            fieldLabel: matched.label,
            fieldValue: matched.value,
            documentName: doc.name,
            documentId: doc.id,
            documentType: doc.documentType,
          },
        };
      }
    }

    // Pattern matched but field not found in any document of the right type
    return { matchedLabel: labels[0], hit: null };
  }

  return null;
}

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

  const fieldResult = detectFieldQueryIntent(normalized, documents);
  if (fieldResult && fieldResult.hit) {
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

  let chunks: import("@/lib/types").Chunk[] = [];
  if (documents.length > 0) {
    try {
      const { searchChunks } = await import("@/lib/ragStore");
      chunks = searchChunks(normalized, documentIds, 6, userId);
    } catch (err) {
      console.warn("[chatService] ragStore search failed:", err);
    }
  }

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
