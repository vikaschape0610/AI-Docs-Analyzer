const Groq = require("groq-sdk");
require("dotenv").config({ path: ".env.local" });

const text = `
आयकर विभाग 
INCOME TAX DEPARTMENT 
भारत सरकार 
GOVT. OF INDIA 
स्थायी लेखा संख्या कार्ड 
Permanent Account Number Card 
CMOPC0713N 
TENN
VIKAS NAMDEV CHAPE 
पिता का नाम / Father's Name 
Cais Had EE J
NAMDEV CHAPE 
जन्म की तारीख / 
Date of Birth 
06/10/2005 
17102023
हस्ताक्षर / Signature
`;

const filename = "Pan card .pdf";

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

async function test() {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  try {
    const res = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: prompt + "\n\nExtracted Text:\n---\n" + text + "\n---"
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });
    console.log("Model Output:\n", res.choices[0].message.content);
  } catch(e) {
    console.error("Error:", e.message);
  }
}
test();
