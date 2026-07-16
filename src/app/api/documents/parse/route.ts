// ─── DocMind AI — Groq AI Document Parse API ──────────────────────────────
// POST /api/documents/parse
//
// Groq is the brain — reads ANY document in ANY language.
// Handles both clean text and broken-font Marathi/Hindi govt PDFs.
// When both TEXT_LAYER and VISION_OCR are provided, Groq reconciles them.

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

    const hasDualInput =
      text.includes("[TEXT_LAYER") && text.includes("[VISION_OCR");

    const prompt = `You are an expert document intelligence AI specializing in Indian government documents, academic certificates, and professional documents. You read ANY language — English, Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, or any other.

Document filename: "${filename ?? "unknown"}"

${
  hasDualInput
    ? `DUAL INPUT HANDLING:
This document has two extraction layers:
  [TEXT_LAYER] — pdf.js text extraction (may have font encoding errors for Marathi/Hindi govt PDFs — words may be split into individual characters)
  [VISION_OCR] — AI vision reading the actual page image (more accurate for names and proper nouns)

Rules for dual input:
- For NAMES of people, places, authorities: ALWAYS prefer [VISION_OCR]
- For NUMBERS (income amounts, certificate numbers, dates, IDs): prefer [TEXT_LAYER] as numbers encode correctly even in broken fonts
- If both agree → use that value with high confidence
- If [TEXT_LAYER] shows garbled text like "व ल" but [VISION_OCR] shows "विठुल" → use "विठुल"

`
    : ""
}EXTRACTION TASK:
Extract ALL fields visible in this document. For Indian government certificates (income cert, caste cert, domicile cert, etc.), the following fields are typically present — extract ALL that exist:
- Name of Applicant / Person Name
- Certificate Number / Reference Number / जा क्रमांक
- Annual Income / वार्षिक उत्पन्न
- Financial Year / वर्ष
- Date of Issue / दिनांक
- Validity / Valid Until
- Issuing Authority / Tahsildar / तहसीलदार
- Tahsil Office / District / Address
- State Government / शासन
- Any printed metadata (OMTID, VLE Name, Printed Date, Barcode numbers)

For ALL document types — extract EVERY field visible, do not skip any.

Return ONLY this JSON (no markdown, no code fences):
{
  "documentType": "income_certificate | aadhaar_card | pan_card | passport | marksheet | caste_certificate | bank_statement | offer_letter | resume | student_id | employee_id | driving_licence | voter_id | birth_certificate | government_certificate | generic",
  "category": "Identity | Academic | Financial | Career | Government | Medical | Other",
  "extractedFields": [
    {
      "label": "Field name in clear English",
      "value": "Exact value as it appears in document",
      "fieldType": "text | number | date | id | address | url"
    }
  ],
  "summary": "One sentence describing this document and who it belongs to."
}

CRITICAL RULES:
1. Extract EVERY field — do not skip anything visible.
2. Never fabricate values. Only extract what is visible in the text.
3. Aadhaar number = always 12 digits (XXXX XXXX XXXX). No other number is Aadhaar.
4. PAN number = always 10 chars like ABCDE1234F. DOB on PAN = person's birth date only.
5. Annual Income = rupee amount only. "2025-2026" is a financial year, NOT an income.
6. Dates: keep exact format. Hindi dates like "०७ मे २०२६" keep as-is.
7. For garbled Marathi text like "व ल" — interpret as a broken rendering of a name.
8. Certificate numbers, reference numbers, barcodes = extract them all as "id" fieldType.
9. Return ONLY the JSON object.

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
