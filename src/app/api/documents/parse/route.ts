// ─── DocMind AI — Groq AI Document Parse API ──────────────────────────────
// POST /api/documents/parse
//
// PHILOSOPHY: Groq is the brain. It reads ANY document in ANY language.
// No hardcoded document types or field names — Groq decides everything.
// Regex (textParser.ts) is only a fast fallback when Groq fails.

import { NextRequest } from "next/server";
import Groq from "groq-sdk";

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

export async function POST(request: NextRequest) {
  try {
    const { text, filename } = (await request.json()) as {
      text?: string;
      filename?: string;
    };

    if (!text?.trim()) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    const groq = getGroqClient();

    const prompt = `You are an expert document intelligence AI. You read and understand documents in ANY language — English, Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, or any other language.

Document filename: "${filename ?? "unknown"}"

IMPORTANT — DUAL INPUT HANDLING:
The text below may contain two sections per page:
  [TEXT_LAYER] — extracted by pdf.js from the PDF's text layer (fast but may have font encoding errors for Indian language PDFs)
  [VISION_OCR] — extracted by AI vision model reading the actual page image (slower but accurate for all languages)

When BOTH sections are present:
- Trust [VISION_OCR] for: names of people, place names, Devanagari text, proper nouns
- Trust [TEXT_LAYER] for: numbers, dates, IDs, codes (these encode correctly even in broken fonts)
- If they agree → use that value
- If they disagree on a name/word → prefer [VISION_OCR]

Your job:
1. Identify what type of document this is
2. Extract ALL meaningful fields visible in the document
3. Field VALUES stay exactly as they appear (do not translate)
4. Field LABELS must be clear English regardless of document language

Return ONLY a valid JSON object:
{
  "documentType": "snake_case type — e.g. aadhaar_card, pan_card, passport, marksheet, income_certificate, caste_certificate, bank_statement, offer_letter, resume, student_id, employee_id, driving_licence, voter_id, birth_certificate, medical_report, insurance_policy, training_certificate, property_document, government_certificate, or any other appropriate type",
  "category": "Identity | Academic | Financial | Career | Government | Medical | Other",
  "extractedFields": [
    {
      "label": "Human-readable English field name",
      "value": "Exact value from document",
      "fieldType": "text | number | date | id | address | url"
    }
  ],
  "summary": "One sentence: what this document is and who it belongs to."
}

CRITICAL RULES:
1. Extract EVERY field you can see — do not skip any.
2. Never fabricate values. Only extract what is clearly visible.
3. Aadhaar number is always 12 digits (XXXX XXXX XXXX). Never mislabel other numbers as Aadhaar.
4. PAN number is always 10 chars (e.g. ABCDE1234F). Date of Birth on PAN is the person's birth date — NOT the card issue date or any other number near the QR code.
5. Annual Income is the money amount only. A financial year like "2022-23" is NOT an income amount.
6. Dates: preserve format exactly as shown. Hindi dates like "०७ मे २०२६" keep as-is.
7. Return ONLY the JSON. No markdown, no code fences, no explanation.

Document text:
---
${text.slice(0, 12000)}
---`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.05,
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const aiContent = completion.choices[0]?.message?.content?.trim();
    if (!aiContent) throw new Error("No response from Groq");

    const parsed = JSON.parse(aiContent);

    if (
      !parsed.documentType ||
      !parsed.category ||
      !Array.isArray(parsed.extractedFields)
    ) {
      throw new Error("Groq response missing required fields");
    }

    parsed.extractedFields = (
      parsed.extractedFields as Array<{
        label: string;
        value: string;
        fieldType: string;
      }>
    )
      .filter(
        (f) =>
          f.label &&
          f.value &&
          String(f.value).trim().length > 0 &&
          String(f.value).length < 400,
      )
      .map((f) => ({
        label: String(f.label).trim(),
        value: String(f.value).trim(),
        fieldType: f.fieldType ?? "text",
      }));

    return Response.json(parsed);
  } catch (err) {
    console.error("[/api/documents/parse] Error:", err);
    return Response.json(
      {
        error: "Failed to parse document",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
