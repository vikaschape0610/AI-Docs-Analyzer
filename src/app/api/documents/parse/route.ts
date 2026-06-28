import { NextRequest } from "next/server";
import Groq from "groq-sdk";

let _groq: Groq | null = null;
function getGroqClient(): Groq {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured.");
    }
    _groq = new Groq({ apiKey });
  }
  return _groq;
}

const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile";

export async function POST(request: NextRequest) {
  try {
    const { text, filename, imageBase64, mimeType } = await request.json();

    if (!text && !imageBase64) {
      return Response.json({ error: "Text or image is required" }, { status: 400 });
    }

    const groq = getGroqClient();

    const prompt = `You are an expert document data extraction AI. You extract structured data from documents.
Here is the document named "${filename}":

Your task is to parse the document and extract relevant fields depending on the document type (e.g. Identity, Financial, Government, Academic, Career). 
If it is an Income Certificate, correctly extract "Annual Income", "Financial Year", "Name", "Certificate Number". Do not confuse years (like 2000, 2021) with Income amounts.
If it is an Aadhaar card, extract "Name", "Aadhaar Number", "Date of Birth", "Gender", "Address", "Pincode".
If it is a PAN card, extract "Name", "PAN Number", "Father's Name", "Date of Birth".
And similarly for other document types.

Return ONLY a JSON object with the following schema:
{
  "documentType": "aadhaar_card" | "pan_card" | "passport" | "student_id" | "employee_id" | "resume" | "marksheet" | "income_certificate" | "caste_certificate" | "bank_statement" | "offer_letter" | "government_certificate" | "generic",
  "category": "Identity" | "Academic" | "Financial" | "Career" | "Government" | "Medical" | "Other",
  "extractedFields": [
    { "label": "Field Name (e.g. Name, Aadhaar Number, Annual Income)", "value": "Extracted Value", "fieldType": "text" | "number" | "date" | "id" | "address" }
  ],
  "summary": "A short 1-sentence summary of the document."
}

Do not include any other text, just the JSON. Ensure the JSON is perfectly valid.`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "user",
          content: prompt + "\n\nExtracted Text:\n---\n" + text + "\n---"
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const aiContent = completion.choices[0]?.message?.content?.trim();
    if (!aiContent) {
      throw new Error("No response from Groq");
    }

    const parsed = JSON.parse(aiContent);
    return Response.json(parsed);
  } catch (err) {
    console.error("[/api/documents/parse] Error:", err);
    return Response.json({ error: "Failed to parse document" }, { status: 500 });
  }
}
