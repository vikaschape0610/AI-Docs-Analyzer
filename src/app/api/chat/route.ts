// ─── DocMind AI — Grounded Reasoning Chat API ────────────────────────────
// POST /api/chat
//
// REASONING PIPELINE:
//   1. Check intent — what is the user asking for?
//   2. Check if relevant document exists → if not, explain clearly
//   3. Check if field exists in document → if not, explain clearly
//   4. Only if structured lookup fails → semantic retrieval
//   5. Only after retrieval → call Groq with EVIDENCE ONLY
//   6. Groq reasons over evidence, never fabricates
//
// This system NEVER hallucinates. Every answer is grounded.

import type { NextRequest } from "next/server";
import Groq from "groq-sdk";
import type {
  Chunk,
  ChatMessage,
  AIResponseType,
  DocumentReference,
  ExtractedField,
  ExtractedFieldHit,
  QueryIntent,
} from "@/lib/types";

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

// ─── Greeting handling ────────────────────────────────────────────────────
const GREETING_RE = /^(hi|hello|hey|good\s+(morning|afternoon|evening|night)|thank(s| you)|bye|goodbye|how are you|sup|greetings)\b/i;

function isGreeting(q: string) { return GREETING_RE.test(q.trim()); }

function greetingResponse(q: string, userName?: string): string {
  const name = userName ? `, ${userName.split(" ")[0]}` : "";
  const lower = q.toLowerCase();
  if (/thank/i.test(lower)) return `You're welcome${name}! Feel free to ask anything about your documents.`;
  if (/bye|goodbye/i.test(lower)) return `Goodbye${name}! Your documents will be ready whenever you return.`;
  if (/good morning/i.test(lower)) return `Good morning${name}! Ready to help with your documents.`;
  if (/good afternoon/i.test(lower)) return `Good afternoon${name}! How can I assist you?`;
  if (/good evening/i.test(lower)) return `Good evening${name}! I'm here to help with your documents.`;
  return `Hello${name}! I'm DocMind AI. Ask me anything about your uploaded documents.`;
}

// ─── System prompt for grounded reasoning ────────────────────────────────
function buildGroundedSystemPrompt(
  evidence: string,
  totalDocs: number,
  userName?: string,
): string {
  return `You are DocMind AI, an expert document intelligence assistant${userName ? ` helping ${userName}` : ""}.

## CRITICAL RULES — NEVER VIOLATE
1. ONLY answer from the evidence provided below. NEVER use outside knowledge.
2. If the evidence does not contain the answer, say exactly: "I couldn't find that information in your documents."
3. NEVER guess, infer, or fabricate any value — especially IDs, numbers, dates, names.
4. If you see partial evidence, quote it exactly and note it may be incomplete.
5. Be precise. Format IDs and numbers exactly as they appear in the evidence.
6. Cite the document name and field when answering.
7. The user has ${totalDocs} document(s) uploaded.

## EVIDENCE FROM DOCUMENTS
${evidence}

## END OF EVIDENCE

Answer the user's question using ONLY the evidence above. If the answer is not in the evidence, say so clearly.`;
}

// ─── Request body type ────────────────────────────────────────────────────
interface ChatAPIBody {
  query: string;
  sessionId: string;
  totalDocuments?: number;
  allDocuments?: DocumentReference[];
  chunks?: Chunk[];
  structuredDocs?: { documentName: string; documentType?: string; fields: ExtractedField[] }[];
  extractedFieldHit?: ExtractedFieldHit;
  queryIntent?: QueryIntent;
  userName?: string;
  // Reasoning pipeline results
  reasoning?: {
    step: "doc_not_found" | "field_not_found" | "field_found" | "rag";
    message?: string;
    docType?: string;
    fieldName?: string;
    docName?: string;
  };
}

// ─── Main Route ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatAPIBody;
    const {
      query,
      totalDocuments = 0,
      allDocuments = [],
      chunks = [],
      structuredDocs = [],
      extractedFieldHit,
      reasoning,
      userName,
    } = body;

    if (!query?.trim()) {
      return Response.json({ error: "Query is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const baseMsg = { role: "assistant" as const, timestamp: now, isStreaming: false };

    // ── Greeting ──────────────────────────────────────────────────────────
    if (isGreeting(query)) {
      return Response.json({
        message: {
          ...baseMsg,
          id: `msg-${Date.now()}-ai`,
          content: greetingResponse(query, userName),
          responseType: "greeting" as AIResponseType,
          confidence: "high" as const,
        },
      });
    }

    // ── No documents ──────────────────────────────────────────────────────
    if (totalDocuments === 0) {
      return Response.json({
        message: {
          ...baseMsg,
          id: `msg-${Date.now()}-ai`,
          content: "You haven't uploaded any documents yet. Upload your first document and I'll be able to answer questions from it.",
          responseType: "no_documents" as AIResponseType,
          confidence: "high" as const,
        },
      });
    }

    // ── Reasoning pipeline: document not found ────────────────────────────
    if (reasoning?.step === "doc_not_found") {
      return Response.json({
        message: {
          ...baseMsg,
          id: `msg-${Date.now()}-ai`,
          content: `I couldn't find ${reasoning.docType ? `a **${reasoning.docType.replace(/_/g, " ")}**` : "the relevant document"} in your uploaded documents. Please upload the document first and ask again.`,
          responseType: "doc_not_found" as AIResponseType,
          confidence: "high" as const,
        },
      });
    }

    // ── Reasoning pipeline: field not found in doc ────────────────────────
    if (reasoning?.step === "field_not_found") {
      return Response.json({
        message: {
          ...baseMsg,
          id: `msg-${Date.now()}-ai`,
          content: `I found your **${reasoning.docName ?? "document"}** but it doesn't contain the **${reasoning.fieldName ?? "requested field"}**. This may be because the field wasn't visible in the document or OCR couldn't read it clearly.`,
          responseType: "field_not_found" as AIResponseType,
          confidence: "high" as const,
        },
      });
    }

    // ── Direct field hit — structured extraction answered it ──────────────
    if (extractedFieldHit) {
      const { fieldLabel, fieldValue, documentName, confidence, page } = extractedFieldHit;
      const conf = confidence ?? 0.9;
      const confLabel: "high" | "medium" | "low" = conf >= 0.85 ? "high" : conf >= 0.6 ? "medium" : "low";
      const confNote = confLabel === "low"
        ? "\n\n⚠️ *This answer may be inaccurate because OCR confidence is low. Please verify against the original document.*"
        : "";

      return Response.json({
        message: {
          ...baseMsg,
          id: `msg-${Date.now()}-ai`,
          content: `**${fieldLabel}**: ${fieldValue}\n\n*Source: ${documentName}${page ? `, Page ${page}` : ""}*${confNote}`,
          responseType: "document_qa" as AIResponseType,
          confidence: confLabel,
          sources: [{
            documentId: extractedFieldHit.documentId,
            documentName,
            category: "Identity",
            page: page ?? 1,
            excerpt: `${fieldLabel}: ${fieldValue}`,
          }],
        },
      });
    }

    // ── No chunks or structured data ──────────────────────────────────────
    if (chunks.length === 0 && structuredDocs.length === 0) {
      return Response.json({
        message: {
          ...baseMsg,
          id: `msg-${Date.now()}-ai`,
          content: `I searched through your ${totalDocuments} document${totalDocuments > 1 ? "s" : ""} but couldn't find relevant information about that. Try rephrasing your question or check if the relevant document is uploaded.`,
          responseType: "not_found" as AIResponseType,
          confidence: "high" as const,
        },
      });
    }

    // ── Build grounded evidence block ────────────────────────────────────
    let evidenceBlock = "";

    // Section 1: Structured extracted fields (highest trust)
    if (structuredDocs.length > 0) {
      const structuredSection = structuredDocs
        .filter((d) => d.fields.length > 0)
        .map((d) => {
          const fieldLines = d.fields
            .map((f) => `  ${f.label}: ${f.value}${f.confidence !== undefined ? ` [confidence: ${Math.round(f.confidence * 100)}%]` : ""}`)
            .join("\n");
          return `[DOCUMENT: ${d.documentName}${d.documentType ? ` | TYPE: ${d.documentType}` : ""}]\n${fieldLines}`;
        })
        .join("\n\n");

      if (structuredSection.trim()) {
        evidenceBlock += `### STRUCTURED FIELDS (pre-extracted, high reliability)\n${structuredSection}\n\n`;
      }
    }

    // Section 2: Raw chunk context
    if (chunks.length > 0) {
      const chunkSection = chunks
        .map((c, i) => `[SOURCE ${i + 1}: ${c.documentName} | Page ${c.pageNum}]\n${c.text}`)
        .join("\n\n---\n\n");
      evidenceBlock += `### RAW DOCUMENT TEXT\n${chunkSection}`;
    }

    // ── Call Groq with grounded prompt ────────────────────────────────────
    const groq = getGroqClient();
    const systemPrompt = buildGroundedSystemPrompt(evidenceBlock, totalDocuments, userName);

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      temperature: 0.05,  // very low — we want factual, not creative
      max_tokens: 1024,
      top_p: 0.9,
    });

    const content = completion.choices[0]?.message?.content?.trim()
      ?? "I couldn't generate a response. Please try again.";

    // Assess confidence from response content
    const hasUncertainty = /couldn't find|not available|unable to|not in|don't see/i.test(content);
    const confidence: "high" | "medium" | "low" = hasUncertainty ? "medium" : "high";

    // De-duplicate sources by doc+page
    const seen = new Set<string>();
    const sources = chunks
      .filter((c) => {
        const k = `${c.documentId}-${c.pageNum}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .slice(0, 3)
      .map((c) => ({
        documentId: c.documentId,
        documentName: c.documentName,
        category: c.category,
        page: c.pageNum,
        excerpt: c.text.slice(0, 160) + (c.text.length > 160 ? "…" : ""),
      }));

    return Response.json({
      message: {
        ...baseMsg,
        id: `msg-${Date.now()}-ai`,
        content,
        responseType: "document_qa" as AIResponseType,
        confidence,
        sources,
      },
    });
  } catch (err) {
    console.error("[/api/chat] Error:", err);
    const msg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({
      message: {
        id: `msg-${Date.now()}-err`,
        role: "assistant",
        timestamp: new Date().toISOString(),
        content: msg.includes("GROQ_API_KEY")
          ? "⚠️ Groq API key not configured. Add `GROQ_API_KEY` to `.env.local`."
          : `Something went wrong: ${msg}`,
        responseType: "general",
        isStreaming: false,
        confidence: "low",
      },
    }, { status: 200 });
  }
}
