// ─── DocMind AI — Groq RAG Chat API Route ────────────────────────────────
// POST /api/chat
//
// Receives a user query + pre-retrieved chunks from the client.
// Builds a RAG context and calls the Groq API for generation.
//
// BACKEND INTEGRATION (Future FastAPI migration):
//   This entire route becomes a FastAPI endpoint:
//     POST /api/v1/chat
//   The request/response shapes must remain the same.
//   Replace this file with a thin proxy that forwards to FastAPI.

import type { NextRequest } from "next/server";
import Groq from "groq-sdk";
import type { Chunk, ChatMessage, AIResponseType, DocumentReference } from "@/lib/types";

// ─── Lazy Groq client (only initialized on first request) ─────────────────
let _groq: Groq | null = null;

function getGroqClient(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey || apiKey === "your_groq_api_key_here") {
      throw new Error(
        "GROQ_API_KEY is not configured. Add it to .env.local and restart the dev server."
      );
    }
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

// ─── Greeting Detection ───────────────────────────────────────────────────
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
  const lower = query.toLowerCase().trim();
  return GREETING_PATTERNS.some((p) => p.test(lower));
}

function getGreetingResponse(query: string): string {
  const lower = query.toLowerCase();
  if (/thank/i.test(lower)) return "You're welcome! Feel free to ask anything about your documents.";
  if (/bye|goodbye/i.test(lower)) return "Goodbye! Your documents will be ready whenever you return.";
  if (/good morning/i.test(lower)) return "Good morning! Ready to help you find information in your documents.";
  if (/good afternoon/i.test(lower)) return "Good afternoon! How can I help you with your documents?";
  if (/good evening/i.test(lower)) return "Good evening! I'm here if you have any questions about your documents.";
  return "Hello! I'm DocMind AI. Upload your documents and ask me anything about them.";
}

// ─── Document Reference Detection ────────────────────────────────────────
// Detects queries like "show my Aadhaar", "open my resume", "find passport"
const DOC_REF_PATTERNS = [
  /\b(show|open|find|display|view|get)\b.*\b(aadhaar|aadhar|pan|passport|resume|cv|marksheet|certificate|offer letter|bank statement|driving licence|birth certificate)\b/i,
  /\b(aadhaar|aadhar|pan card|passport|resume|cv)\b.*\b(show|open|find|display)\b/i,
];

function isDocumentReferenceQuery(query: string): boolean {
  return DOC_REF_PATTERNS.some((p) => p.test(query));
}

// ─── System Prompt Builder ────────────────────────────────────────────────
function buildSystemPrompt(chunks: Chunk[], totalDocs: number): string {
  const contextBlocks = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}: ${c.documentName} | ${c.category} | Page ${c.pageNum}]\n${c.text}`
    )
    .join("\n\n---\n\n");

  return `You are DocMind AI, an expert document intelligence assistant. You help users find information from their personal documents.

## Instructions
- Answer ONLY based on the provided document context below.
- Be precise and cite your sources by mentioning the document name and page number.
- If the answer is in the context, give a clear, direct answer.
- If the answer is NOT in the context, say: "I couldn't find that information in your uploaded documents. Try uploading the relevant document or rephrasing your question."
- Never fabricate information, IDs, numbers, or dates.
- Format numbers and IDs exactly as they appear in the documents.
- The user has ${totalDocs} document(s) uploaded in total.
- For structured data (like Aadhaar numbers, PAN numbers, dates), quote them exactly.
- Keep answers concise and focused. Use markdown formatting when helpful.

## Document Context
${contextBlocks}

## End of Context
Answer the user's question based strictly on the above context.`;
}

// ─── Request / Response Types ─────────────────────────────────────────────
interface ChatAPIRequest {
  query: string;
  sessionId: string;
  documentIds?: string[];
  chunks?: Chunk[];
  totalDocuments?: number;
  allDocuments?: DocumentReference[];
  extractedFieldHit?: {
    fieldLabel: string;
    fieldValue: string;
    documentName: string;
    documentId: string;
    documentType?: string;
  };
}

// ─── Main Route Handler ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatAPIRequest;
    const { query, sessionId, chunks = [], totalDocuments = 0, allDocuments = [], extractedFieldHit } = body;

    if (!query?.trim()) {
      return Response.json({ error: "Query is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const baseMessage = {
      id: `msg-${Date.now()}-ai`,
      role: "assistant" as const,
      timestamp: now,
      isStreaming: false,
    };

    // ── Handle greetings without Groq call ────────────────────────────
    if (isGreeting(query)) {
      const msg: ChatMessage = {
        ...baseMessage,
        content: getGreetingResponse(query),
        responseType: "greeting" as AIResponseType,
      };
      return Response.json({ message: msg });
    }

    // ── Handle direct field hit (no Groq needed) ───────────────────────
    if (extractedFieldHit) {
      const { fieldLabel, fieldValue, documentName } = extractedFieldHit;
      const msg: ChatMessage = {
        ...baseMessage,
        content: `**${fieldLabel}**: ${fieldValue}\n\n*From: ${documentName}*`,
        responseType: "document_qa" as AIResponseType,
        sources: [{
          documentId: extractedFieldHit.documentId,
          documentName,
          category: "Identity",
          page: 1,
          excerpt: `${fieldLabel}: ${fieldValue}`,
        }],
      };
      return Response.json({ message: msg });
    }

    // ── Handle no documents ────────────────────────────────────────────
    if (totalDocuments === 0) {
      const msg: ChatMessage = {
        ...baseMessage,
        content:
          "It looks like you haven't uploaded any documents yet. Upload your first document and I'll be able to answer questions from it instantly.",
        responseType: "no_documents" as AIResponseType,
      };
      return Response.json({ message: msg });
    }

    // ── Handle document reference query ───────────────────────────────
    if (isDocumentReferenceQuery(query) && allDocuments.length > 0) {
      const queryLower = query.toLowerCase();
      const matchedDocs = allDocuments.filter((doc) => {
        const nameLower = doc.documentName.toLowerCase();
        const catLower = doc.category.toLowerCase();
        return (
          nameLower.split(/[\s._-]/).some((w) => queryLower.includes(w)) ||
          queryLower.includes(catLower) ||
          queryLower.includes("aadhaar") && catLower === "identity" ||
          queryLower.includes("resume") && catLower === "career" ||
          queryLower.includes("marksheet") && catLower === "academic" ||
          queryLower.includes("passport") && catLower === "identity" ||
          queryLower.includes("bank") && catLower === "financial"
        );
      });

      if (matchedDocs.length > 0) {
        const msg: ChatMessage = {
          ...baseMessage,
          content: `I found ${matchedDocs.length} document${matchedDocs.length > 1 ? "s" : ""} matching your request:`,
          responseType: "document_list" as AIResponseType,
          documents: matchedDocs,
        };
        return Response.json({ message: msg });
      }
    }

    // ── No relevant chunks found ───────────────────────────────────────
    if (chunks.length === 0) {
      const msg: ChatMessage = {
        ...baseMessage,
        content: `I searched through your ${totalDocuments} document${totalDocuments > 1 ? "s" : ""} but couldn't find relevant information about that. Try uploading a document that contains this information, or rephrase your question.`,
        responseType: "not_found" as AIResponseType,
      };
      return Response.json({ message: msg });
    }

    // ── Build RAG context + call Groq ──────────────────────────────────
    const groq = getGroqClient();
    const systemPrompt = buildSystemPrompt(chunks, totalDocuments);

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: query },
      ],
      temperature: 0.1,       // low temp for factual document QA
      max_tokens: 1024,
      top_p: 0.9,
    });

    const aiContent =
      completion.choices[0]?.message?.content?.trim() ??
      "I couldn't generate a response. Please try again.";

    // Build source citations from the chunks used
    const uniqueSources = Array.from(
      new Map(chunks.map((c) => [c.documentId, c])).values()
    );

    const sources = uniqueSources.slice(0, 3).map((c) => ({
      documentId: c.documentId,
      documentName: c.documentName,
      category: c.category,
      page: c.pageNum,
      excerpt: c.text.slice(0, 160) + (c.text.length > 160 ? "…" : ""),
    }));

    const msg: ChatMessage = {
      ...baseMessage,
      content: aiContent,
      responseType: "document_qa" as AIResponseType,
      sources,
    };

    return Response.json({ message: msg });
  } catch (err) {
    console.error("[/api/chat] Error:", err);
    const message =
      err instanceof Error ? err.message : "An unexpected error occurred";

    // Return structured error so UI shows something useful
    const errorMsg: ChatMessage = {
      id: `msg-${Date.now()}-error`,
      role: "assistant",
      timestamp: new Date().toISOString(),
      content: message.includes("GROQ_API_KEY")
        ? "⚠️ Groq API key not configured. Add `GROQ_API_KEY` to `.env.local` and restart the dev server."
        : `Something went wrong: ${message}. Please try again.`,
      responseType: "general",
      isStreaming: false,
    };

    return Response.json({ message: errorMsg }, { status: 200 });
  }
}
