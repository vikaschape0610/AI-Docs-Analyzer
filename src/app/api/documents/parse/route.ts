// ─── DocMind AI — Groq AI Document Parse API ──────────────────────────────
// POST /api/documents/parse
//
// Receives extracted text (or image base64) and uses Groq to extract
// structured fields. Returns a JSON object matching the ParseResult schema.
//
// Improvements over v1:
//   - Enforces exact field label names that match chatService FIELD_INTENT_PATTERNS
//   - Validates and sanitizes Groq response before returning
//   - Returns documentType so documentService merge is safe
//   - Provides per-doc-type extraction hints to reduce hallucination

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

// ─── Exact field label rules sent to the model ────────────────────────────
// These labels MUST match the keys in chatService.ts FIELD_INTENT_PATTERNS
// so that the field-intent shortcut works correctly.
const FIELD_LABEL_RULES = `
CRITICAL FIELD LABEL RULES — use these EXACT labels, no variations:
- Aadhaar card: "Name", "Aadhaar Number", "Date of Birth", "Gender", "Address", "Pincode"
- PAN card: "Name", "PAN Number", "Father's Name", "Date of Birth"
- Passport: "Name", "Passport Number", "Date of Birth", "Gender", "Nationality", "Date of Issue", "Date of Expiry", "Place of Issue", "Place of Birth"
- Student ID: "Name", "Institute", "CRN / Roll No", "Branch / Department", "Class / Year", "Division", "Academic Year / Validity"
- Marksheet: "Name", "Roll Number", "University / Board", "Semester / Exam", "Academic Year", "SGPA", "CGPA", "Percentage"
- Income Certificate: "Name", "Certificate Number", "Annual Income", "Financial Year", "Issuing Authority", "Date of Issue"
  - IMPORTANT: Do NOT label the income amount as "Income" — use "Annual Income". Do NOT confuse years (like 2020, 2021) with income amounts.
- Caste Certificate: "Name", "Certificate Number", "Caste / Category", "Issuing Authority", "Date of Issue"
- Bank Statement: "Account Holder", "Account Number", "Bank Name", "IFSC Code", "Branch", "Statement Period", "Closing Balance"
- Offer Letter: "Candidate Name", "Company", "Designation", "CTC / Salary", "Joining Date", "Department"
- Resume: "Name", "Email", "Phone", "Skills", "Experience", "Education"
- Government Certificate: "Name", "Certificate Number", "Certificate Type", "Issuing Authority", "Date of Issue"
`;

export async function POST(request: NextRequest) {
  try {
    const { text, filename } = (await request.json()) as {
      text?: string;
      filename?: string;
      imageBase64?: string;
      mimeType?: string;
    };

    if (!text?.trim()) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    const groq = getGroqClient();

    const prompt = `You are an expert document data extraction AI specializing in Indian government documents, academic certificates, and professional documents.

Document filename: "${filename ?? "unknown"}"

${FIELD_LABEL_RULES}

Analyze the extracted document text and return ONLY a valid JSON object with this exact schema:
{
  "documentType": one of: "aadhaar_card" | "pan_card" | "passport" | "student_id" | "employee_id" | "resume" | "marksheet" | "income_certificate" | "caste_certificate" | "bank_statement" | "offer_letter" | "government_certificate" | "generic",
  "category": one of: "Identity" | "Academic" | "Financial" | "Career" | "Government" | "Medical" | "Other",
  "extractedFields": [
    { "label": "Exact label from the rules above", "value": "Extracted value as-is from text", "fieldType": "text" | "number" | "date" | "id" | "address" }
  ],
  "summary": "One concise sentence summarizing the document."
}

Rules:
1. Use EXACT field labels from the FIELD LABEL RULES above — do not invent new label names.
2. Never fabricate values. Only include fields you can see in the text.
3. For Aadhaar number: extract the 12-digit number (format: XXXX XXXX XXXX). Never label any other number as Aadhaar Number.
4. For Annual Income: extract only the income amount in rupees. A year like "2021" or "2022-23" is NOT an income amount.
5. For dates: preserve the format exactly as it appears (DD/MM/YYYY or DD-MM-YYYY).
6. Return ONLY the JSON object. No markdown, no explanation, no code fences.

Extracted Document Text:
---
${text.slice(0, 6000)}
---`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.05,
      response_format: { type: "json_object" },
      max_tokens: 1500,
    });

    const aiContent = completion.choices[0]?.message?.content?.trim();
    if (!aiContent) throw new Error("No response from Groq");

    const parsed = JSON.parse(aiContent);

    // ── Validate and sanitize the response ────────────────────────────────
    // Ensure required keys exist and extractedFields is an array
    if (
      !parsed.documentType ||
      !parsed.category ||
      !Array.isArray(parsed.extractedFields)
    ) {
      throw new Error("Groq response missing required fields");
    }

    // Filter out any fields with empty values or overly long values
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
          String(f.value).length < 300,
      )
      .map((f) => ({
        label: String(f.label).trim(),
        value: String(f.value).trim(),
        fieldType: f.fieldType ?? "text",
      }));

    return Response.json(parsed);
  } catch (err) {
    console.error("[/api/documents/parse] Error:", err);
    // Return a structured error so documentService can fall back gracefully
    return Response.json(
      {
        error: "Failed to parse document",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
