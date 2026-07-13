// ─── DocMind AI — Groq Vision OCR API ────────────────────────────────────
// POST /api/documents/ocr
//
// Receives a base64 image of a document page and uses Groq's vision model
// to extract text. Far superior to Tesseract for:
//   - Hindi/Marathi Devanagari conjunct consonants (ठ्ठ, ज्ञ, क्ष, श्र)
//   - Handwritten text
//   - Low quality scans / camera photos
//   - Mixed language documents
//   - Tables and structured layouts
//   - Any language worldwide
//
// Model: meta-llama/llama-4-scout-17b-16e-instruct (Groq vision)
// Fallback: returns empty text so caller falls back to Tesseract

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

const GROQ_VISION_MODEL =
  process.env.GROQ_VISION_MODEL ?? "meta-llama/llama-4-scout-17b-16e-instruct";

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, mimeType, pageNum } = (await request.json()) as {
      imageBase64?: string;
      mimeType?: string;
      pageNum?: number;
    };

    if (!imageBase64?.trim()) {
      return Response.json(
        { error: "imageBase64 is required" },
        { status: 400 },
      );
    }

    const groq = getGroqClient();
    const imageMime = mimeType ?? "image/jpeg";

    const completion = await groq.chat.completions.create({
      model: GROQ_VISION_MODEL,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${imageMime};base64,${imageBase64}`,
              },
            },
            {
              type: "text",
              text: `You are an expert OCR system. Extract ALL text visible in this document image exactly as it appears.

Instructions:
- Preserve the original text in its original language (Hindi, Marathi, English, or any other language)
- Do NOT translate anything — output exactly what is written
- Preserve numbers, dates, IDs exactly as shown (e.g. "1234 5678 9012", "06/10/2005")
- Preserve Devanagari script exactly (e.g. "नामदेव विठ्ठल चापे", "तहसीलदार छत्रपती संभाजीनगर")
- Include all field labels and their values
- Preserve table structure using spaces or | separators where possible
- Output ONLY the extracted text — no explanation, no commentary, no markdown

Extract all text from this document image:`,
            },
          ],
        },
      ],
      temperature: 0.0,
      max_tokens: 4096,
    });

    const extractedText = completion.choices[0]?.message?.content?.trim() ?? "";

    console.log(
      `[/api/documents/ocr] Page ${pageNum ?? 1}: extracted ${extractedText.length} chars via Groq vision (${GROQ_VISION_MODEL})`,
    );

    return Response.json({ text: extractedText, pageNum: pageNum ?? 1 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[/api/documents/ocr] Vision OCR error:", msg);
    // Return empty — caller falls back to Tesseract
    return Response.json({ text: "", error: msg }, { status: 200 });
  }
}
