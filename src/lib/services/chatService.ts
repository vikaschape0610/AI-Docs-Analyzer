// ─── DocMind AI — Chat Service (Groq RAG + Query Intelligence) ────────────
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  Document,
  DocumentReference,
  ExtractedField,
  ExtractedFieldHit,
} from "@/lib/types";

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
  [/\bcollege\s+card\b/gi, "id card"],
  [/\bstudent\s+card\b/gi, "id card"],
  [/\broll\s+no\b/gi, "roll number"],
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

const FIELD_INTENT_PATTERNS: { labels: string[]; patterns: RegExp[] }[] = [
  { labels: ["Aadhaar Number"], patterns: [/aadhaar|aadhar|adhar|uid\s*number/i] },
  { labels: ["PAN Number"], patterns: [/pan\s*(card|number|no)?/i, /permanent\s+account/i] },
  { labels: ["Passport Number"], patterns: [/passport\s*(number|no)?/i] },
  { labels: ["CRN / Roll No", "Roll Number"], patterns: [/crn|roll\s*(no|number)/i, /enrollment\s*(no|number)/i] },
  { labels: ["Branch / Department", "Branch"], patterns: [/\bbranch\b|\bdepartment\b|\bdept\b/i] },
  { labels: ["Class / Year"], patterns: [/\bclass\b|\byear\b/i] },
  { labels: ["Division"], patterns: [/\bdivision\b|\bdiv\b/i] },
  { labels: ["Certificate Number"], patterns: [/certificate\s*(no|number)?|cert\s*(no|id)/i] },
  { labels: ["Annual Income"], patterns: [/income\s*(amount|rs)?|annual\s*income/i] },
  { labels: ["CGPA"], patterns: [/cgpa|cumulative\s+grade/i] },
  { labels: ["SGPA"], patterns: [/sgpa|semester\s+grade/i] },
  { labels: ["Percentage"], patterns: [/percentage|percent/i] },
  { labels: ["Date of Birth"], patterns: [/\bdob\b|date of birth|birth\s*date/i] },
  { labels: ["IFSC Code"], patterns: [/ifsc/i] },
  { labels: ["Account Number"], patterns: [/account\s*(no|number)/i] },
  { labels: ["CTC / Salary", "CTC"], patterns: [/\bctc\b|salary|package/i] },
  { labels: ["Designation"], patterns: [/designation|job\s*title|position/i] },
  { labels: ["Institute"], patterns: [/institute|college\s*name/i] },
];

function detectFieldQueryIntent(
  normalizedQuery: string,
  documents: Document[],
): { hit: ExtractedFieldHit | null; matchedLabel: string } | null {
  const q = normalizedQuery.toLowerCase();

  for (const { labels, patterns } of FIELD_INTENT_PATTERNS) {
    if (!patterns.some((p) => p.test(q))) continue;

    for (const doc of documents) {
      if (!doc.extractedInfo) continue;
      const matched = doc.extractedInfo.find((f: ExtractedField) =>
        labels.some((l) => f.label.toLowerCase() === l.toLowerCase())
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
      body: JSON.stringify({ query, sessionId, totalDocuments: documents.length }),
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
