// ─── DocMind AI — Text Intelligence Parser (Document-Type-Aware) ──────────
// Pipeline:
//   1. Detect document type from text + filename signals
//   2. Run document-type-specific field extraction
//   3. Return normalized fields, category, tags, summary
//
// KEY RULES:
//   - Aadhaar number is ONLY extracted when docType === "aadhaar_card"
//   - Income cert / reference numbers are NEVER labeled "Aadhaar Number"
//   - Field labels MUST exactly match keys in chatService FIELD_INTENT_PATTERNS

import type {
  ExtractedField,
  DocumentCategory,
  DocumentType,
} from "@/lib/types";

export interface ParseResult {
  category: DocumentCategory;
  documentType: DocumentType;
  thumbnailEmoji: string;
  thumbnailColor: string;
  tags: string[];
  extractedFields: ExtractedField[];
  summary: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function first(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const v = m[1].trim().replace(/\s+/g, " ");
      if (v.length > 0 && v.length < 250) return v;
    }
  }
  return null;
}

function field(
  label: string,
  value: string | null,
  fieldType: ExtractedField["fieldType"] = "text",
): ExtractedField | null {
  if (!value || value.trim().length < 1) return null;
  return { label, value: value.trim(), fieldType };
}

function push(arr: ExtractedField[], f: ExtractedField | null) {
  if (f) arr.push(f);
}

// ─── Step 1: Document Type Detection ──────────────────────────────────────

export function detectDocumentType(
  text: string,
  filename: string,
): DocumentType {
  const t = text.toLowerCase();
  const f = filename.toLowerCase();

  // ── Aadhaar: UIDAI signals OR 12-digit number with gov context
  if (
    t.includes("unique identification authority") ||
    t.includes("uidai") ||
    ((t.includes("aadhaar") || t.includes("aadhar") || t.includes("adhar")) &&
      (t.includes("government of india") ||
        /\b\d{4}\s\d{4}\s\d{4}\b/.test(t))) ||
    f.includes("aadhaar") ||
    f.includes("aadhar")
  )
    return "aadhaar_card";

  // ── PAN card
  if (
    t.includes("permanent account number") ||
    t.includes("income tax department") ||
    (t.includes("pan") && /\b[A-Z]{5}[0-9]{4}[A-Z]\b/.test(text)) ||
    f.includes("pan")
  )
    return "pan_card";

  // ── Passport
  if (
    (t.includes("republic of india") &&
      (t.includes("passport") || t.includes("nationality"))) ||
    t.includes("place of issue") ||
    /P<IND/.test(text) ||
    f.includes("passport")
  )
    return "passport";

  // ── Income Certificate (before caste cert to avoid overlap)
  if (
    t.includes("income certificate") ||
    t.includes("annual income") ||
    t.includes("income of rs") ||
    (t.includes("certificate") &&
      t.includes("income") &&
      t.includes("tehsil")) ||
    t.includes("उत्पन्न") ||
    t.includes("प्रमाणपत्र") ||
    t.includes("तहसीलदार") ||
    t.includes("तहसील") ||
    f.includes("income")
  )
    return "income_certificate";

  // ── Caste Certificate
  if (
    t.includes("caste certificate") ||
    (t.includes("certificate") &&
      (t.includes("caste") || t.includes("obc") || t.includes("scheduled"))) ||
    f.includes("caste")
  )
    return "caste_certificate";

  // ── Other Government Certificates
  if (
    t.includes("domicile certificate") ||
    t.includes("birth certificate") ||
    t.includes("bonafide certificate") ||
    t.includes("migration certificate") ||
    t.includes("residence certificate") ||
    f.includes("domicile") ||
    f.includes("bonafide") ||
    f.includes("migration")
  )
    return "government_certificate";

  // ── Marksheet
  if (
    t.includes("marksheet") ||
    t.includes("mark sheet") ||
    (t.includes("semester") &&
      (t.includes("sgpa") ||
        t.includes("cgpa") ||
        t.includes("marks obtained"))) ||
    (t.includes("university") && t.includes("examination")) ||
    f.includes("marksheet") ||
    f.includes("result")
  )
    return "marksheet";

  // ── Bank Statement
  if (
    t.includes("bank statement") ||
    t.includes("account statement") ||
    (t.includes("transaction") &&
      (t.includes("debit") || t.includes("credit")) &&
      t.includes("balance")) ||
    f.includes("statement")
  )
    return "bank_statement";

  // ── Offer / Appointment / Experience Letter
  if (
    t.includes("offer letter") ||
    t.includes("appointment letter") ||
    t.includes("experience letter") ||
    (t.includes("joining date") && t.includes("ctc")) ||
    f.includes("offer") ||
    f.includes("appointment")
  )
    return "offer_letter";

  // ── Resume / CV
  if (
    t.includes("curriculum vitae") ||
    t.includes("career objective") ||
    t.includes("professional summary") ||
    (t.includes("resume") &&
      (t.includes("skills") || t.includes("experience"))) ||
    (t.includes("work experience") &&
      t.includes("education") &&
      t.includes("skills")) ||
    f.includes("resume") ||
    f.includes("cv")
  )
    return "resume";

  // ── Student ID Card
  if (
    t.includes("student identity card") ||
    t.includes("student id card") ||
    (t.includes("identity card") &&
      (t.includes("student") || t.includes("crn"))) ||
    (t.includes("crn") && (t.includes("branch") || t.includes("division"))) ||
    (t.includes("academic year") && t.includes("division")) ||
    f.includes("student_id") ||
    f.includes("college_id")
  )
    return "student_id";

  // ── Employee ID Card
  if (
    t.includes("employee id") ||
    t.includes("staff id") ||
    (t.includes("employee") &&
      t.includes("department") &&
      !t.includes("curriculum"))
  )
    return "employee_id";

  return "generic";
}

// ─── Document-Specific Extractors ─────────────────────────────────────────

function extractAadhaar(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Name",
      first(text, [
        // Name appears before DOB/Gender in standard Aadhaar layout
        /([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+)[\s\S]{0,80}?(?:DOB|Date of Birth|Male|Female|पुरुष|महिला)/i,
        /Name[:\s]+([A-Za-z\s]{4,40})/i,
        /(?:To|To,)?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/m,
      ]),
    ),
  );
  push(
    f,
    field(
      "Aadhaar Number",
      first(text, [
        /\b(\d{4}\s?\d{4}\s?\d{4})\b/,
        /aadhaar[:\s#]*(\d{4}\s?\d{4}\s?\d{4})/i,
        /aadhar[:\s#]*(\d{4}\s?\d{4}\s?\d{4})/i,
        /adhar[:\s#]*(\d{4}\s?\d{4}\s?\d{4})/i,
        /uid[:\s#]*(\d{4}\s?\d{4}\s?\d{4})/i,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Date of Birth",
      first(text, [
        /(?:dob|date of birth|जन्म तारीख|birth)[\s:/-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /Year of Birth[:\s]*(\d{4})/i,
        /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
      ]),
      "date",
    ),
  );
  push(
    f,
    field(
      "Gender",
      first(text, [/\b(Male|Female|Transgender)\b/i, /पुरुष|महिला/i]),
      "text",
    ),
  );
  push(
    f,
    field(
      "Address",
      first(text, [
        /(?:address|पत्ता)[:\s]+([\s\S]{10,120}?)(?:\n\d|\d{6}|VID|$)/i,
      ]),
      "address",
    ),
  );
  push(
    f,
    field(
      "Pincode",
      first(text, [
        /\b(4\d{5})\b/, // Maharashtra PINs start with 4
        /\b(\d{6})\b/,
        /pin\s*(?:code)?[:\s]*(\d{6})/i,
      ]),
      "id",
    ),
  );
  return f;
}

function extractPAN(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Name",
      first(text, [
        /(?:Name|Name of Taxpayer)[:\s]+([A-Z][A-Za-z\s]{3,40})/i,
        /INCOME TAX DEPARTMENT[\s\S]*?\n([A-Z][A-Za-z\s]{3,40})\n/i,
        /\b([A-Z]{3,}(?:\s+[A-Z]{2,})+)\b/,
      ]),
    ),
  );
  push(
    f,
    field(
      "PAN Number",
      first(text, [
        /\b([A-Z]{5}[0-9]{4}[A-Z])\b/,
        /permanent\s+account\s+number[:\s]*([A-Z]{5}[0-9]{4}[A-Z])/i,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Father's Name",
      first(text, [
        /father(?:'s)?\s*name[:\s]+([A-Za-z\s]{3,40})/i,
        /s\/o[:\s]+([A-Za-z\s]{3,40})/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Date of Birth",
      first(text, [
        /(?:dob|date of birth)[\s:/-]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
      ]),
      "date",
    ),
  );
  return f;
}

function extractPassport(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Name",
      first(text, [
        /surname[:\s]+([A-Za-z\s]+?)(?:\n|$)/i,
        /given\s*name(?:s)?[:\s]+([A-Za-z\s]+?)(?:\n|$)/i,
        /Name[:\s]+([A-Za-z\s]{4,40})/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Passport Number",
      first(text, [
        /\b([A-Z][0-9]{7})\b/,
        /passport\s*(?:no\.?|number)[:\s]*([A-Z][0-9]{7})/i,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Nationality",
      first(text, [/nationality[:\s]*([A-Za-z]+)/i]),
      "text",
    ),
  );
  push(
    f,
    field(
      "Date of Birth",
      first(text, [
        /d(?:ate)?\.?\s*of\s*birth[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]),
      "date",
    ),
  );
  push(
    f,
    field(
      "Gender",
      first(text, [/sex[:\s]*(Male|Female|M|F)\b/i, /\b(Male|Female)\b/i]),
      "text",
    ),
  );
  push(
    f,
    field(
      "Place of Birth",
      first(text, [/place\s*of\s*birth[:\s]+([A-Za-z\s,]+?)(?:\n|$)/i]),
      "text",
    ),
  );
  push(
    f,
    field(
      "Date of Issue",
      first(text, [
        /date\s*of\s*issue[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]),
      "date",
    ),
  );
  push(
    f,
    field(
      "Date of Expiry",
      first(text, [
        /date\s*of\s*expiry[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]),
      "date",
    ),
  );
  push(
    f,
    field(
      "Place of Issue",
      first(text, [/place\s*of\s*issue[:\s]+([A-Za-z\s,]+?)(?:\n|$)/i]),
      "text",
    ),
  );
  return f;
}

function extractStudentID(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Institute",
      first(text, [
        /institute\s*(?:of|name)?[:\s]+([A-Za-z\s,&.()-]{5,80}?)(?:\n|$)/i,
        /college[:\s]+([A-Za-z\s,&.()-]{5,80}?)(?:\n|$)/i,
        /university[:\s]+([A-Za-z\s,&.()-]{5,80}?)(?:\n|$)/i,
        /^([A-Z][A-Za-z\s,&.'()-]{10,80})/m,
      ]),
    ),
  );
  push(
    f,
    field(
      "Name",
      first(text, [
        /(?:student\s*)?name[:\s]+([A-Za-z\s.]{3,40}?)(?:\n|$|crn|roll)/i,
        /name\s*of\s*student[:\s]+([A-Za-z\s.]{3,40}?)(?:\n|$)/i,
        /\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b/,
      ]),
    ),
  );
  // Label must exactly match FIELD_INTENT_PATTERNS key "CRN / Roll No"
  push(
    f,
    field(
      "CRN / Roll No",
      first(text, [
        /crn[:\s#]*([A-Z0-9]+)/i,
        /roll\s*(?:no\.?|number)[:\s]*([A-Z0-9]+)/i,
        /enrollment\s*(?:no\.?|number)[:\s]*([A-Z0-9]+)/i,
        /student\s*id[:\s#]*([A-Z0-9]+)/i,
        /reg(?:istration)?\s*(?:no\.?|number)[:\s]*([A-Z0-9]+)/i,
        /\b([0-9]{8,15})\b/,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Branch / Department",
      first(text, [
        /branch[:\s]+([A-Za-z\s()\/&.]{3,60}?)(?:\n|$)/i,
        /dept(?:artment)?[:\s]+([A-Za-z\s()\/&.]{3,60}?)(?:\n|$)/i,
        /course[:\s]+([A-Za-z\s()\/&.]{3,60}?)(?:\n|$)/i,
        /program(?:me)?[:\s]+([A-Za-z\s()\/&.]{3,60}?)(?:\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Class / Year",
      first(text, [
        /class[:\s]+([A-Za-z\s.,()\\d]{2,30}?)(?:\n|$)/i,
        /year[:\s]+([A-Za-z\s.\d]{2,20}?)(?:\n|$)/i,
        /((?:first|second|third|fourth|1st|2nd|3rd|4th|f\.e\.|s\.e\.|t\.e\.|b\.e\.)\s*year)/i,
        /(?:semester|sem)\s*[:\-]?\s*(\d+)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Division",
      first(text, [
        /division[:\s]+([A-Za-z0-9\s]{1,10}?)(?:\n|$)/i,
        /div[:\s]+([A-Z0-9]{1,5})(?:\n|$)/i,
        /section[:\s]+([A-Z0-9]{1,5})(?:\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Academic Year / Validity",
      first(text, [
        /academic\s*year[:\s]*([\d]{4}[-–]\d{2,4})/i,
        /valid\s*(?:upto|till|through|for)[:\s]*([A-Za-z\d\s,./–-]{3,30}?)(?:\n|$)/i,
        /validity[:\s]+([A-Za-z\d\s,./–-]{3,30}?)(?:\n|$)/i,
        /(\d{4}\s*-\s*\d{2,4})/,
      ]),
      "date",
    ),
  );
  return f;
}

function extractEmployeeID(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Company",
      first(text, [
        /company[:\s]+([A-Za-z\s.,()&]{3,60}?)(?:\n|$)/i,
        /organization[:\s]+([A-Za-z\s.,()&]{3,60}?)(?:\n|$)/i,
        /^([A-Z][A-Za-z\s,&.'()-]{10,60})\s*\n/m,
      ]),
    ),
  );
  push(
    f,
    field("Name", first(text, [/name[:\s]+([A-Za-z\s.]{3,40}?)(?:\n|$)/i])),
  );
  push(
    f,
    field(
      "Employee ID",
      first(text, [
        /employee\s*(?:id|no\.?|number|code)[:\s#]*([A-Z0-9]+)/i,
        /staff\s*(?:id|no\.?)[:\s#]*([A-Z0-9]+)/i,
        /emp\.?\s*(?:id|no\.?|code)[:\s#]*([A-Z0-9]+)/i,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Department",
      first(text, [/dept(?:artment)?[:\s]+([A-Za-z\s()\/&.]{3,50}?)(?:\n|$)/i]),
    ),
  );
  push(
    f,
    field(
      "Designation",
      first(text, [
        /designation[:\s]+([A-Za-z\s\-]{3,50}?)(?:\n|$)/i,
        /position[:\s]+([A-Za-z\s\-]{3,50}?)(?:\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Valid Upto",
      first(text, [
        /valid\s*(?:upto|till|through)[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]),
      "date",
    ),
  );
  return f;
}

function extractResume(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Name",
      first(text, [
        /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*\n/m,
        /name[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Email",
      first(text, [/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/]),
      "text",
    ),
  );
  push(
    f,
    field(
      "Phone",
      first(text, [
        /(?:mobile|phone|tel|contact)[:\s]*(\+?[\d\s\-]{8,15})/i,
        /\b(\+91[\s\-]?\d{5}[\s\-]?\d{5})\b/,
      ]),
    ),
  );
  push(
    f,
    field(
      "Skills",
      first(text, [
        /skills?[:\s]+(.{10,200}?)(?:\n\n|\n[A-Z]|$)/i,
        /technical\s*skills?[:\s]+(.{10,200}?)(?:\n\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Experience",
      first(text, [
        /(?:total\s*)?experience[:\s]+(.{3,50}?)(?:\n|$)/i,
        /(\d+\+?\s*years?\s+(?:of\s+)?experience)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Education",
      first(text, [
        /education[:\s\n]+(.{5,100}?)(?:\n\n|$)/i,
        /(B\.?Tech|B\.?E\.|M\.?Tech|MCA|BCA|B\.Sc|M\.Sc|MBA|MBBS)[^,\n]*/i,
      ]),
    ),
  );
  return f;
}

function extractMarksheet(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Name",
      first(text, [
        /(?:student'?s?\s*)?name[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$|roll|seat)/i,
        /name\s*of\s*(?:the\s*)?student[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i,
        /\b([A-Z][a-z]+(?: [A-Z][a-z]+)+)\b/,
      ]),
    ),
  );
  // Label must match FIELD_INTENT_PATTERNS "Roll Number"
  push(
    f,
    field(
      "Roll Number",
      first(text, [
        /roll\s*(?:no\.?|number)[:\s]*([A-Z0-9]+)/i,
        /seat\s*(?:no\.?|number)[:\s]*([A-Z0-9]+)/i,
        /enroll(?:ment)?\s*(?:no\.?|number)[:\s]*([A-Z0-9]+)/i,
        /\b([A-Z]\d{5,10})\b/,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "University / Board",
      first(text, [
        /university[:\s]+([A-Za-z\s,&.()-]{5,80}?)(?:\n|$)/i,
        /board[:\s]+([A-Za-z\s,&.()-]{5,80}?)(?:\n|$)/i,
        /((?:[A-Z][a-z]+\s+)+University(?:\s+of\s+[A-Z][a-z]+)*)/,
      ]),
    ),
  );
  push(
    f,
    field(
      "Semester / Exam",
      first(text, [
        /semester[:\s]*(\d+(?:st|nd|rd|th)?)/i,
        /(\d+(?:st|nd|rd|th)\s+semester)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Academic Year",
      first(text, [
        /academic\s*year[:\s]*([\d]{4}[-–]\d{2,4})/i,
        /year[:\s]*([\d]{4}[-–]\d{2,4})/i,
        /\b(20\d{2})\b/,
      ]),
      "date",
    ),
  );
  // Labels must match FIELD_INTENT_PATTERNS "SGPA" / "CGPA" / "Percentage"
  push(
    f,
    field("SGPA", first(text, [/s\.?g\.?p\.?a\.?[:\s]*([0-9.]+)/i]), "number"),
  );
  push(
    f,
    field("CGPA", first(text, [/c\.?g\.?p\.?a\.?[:\s]*([0-9.]+)/i]), "number"),
  );
  push(
    f,
    field(
      "Percentage",
      first(text, [
        /percentage[:\s]*([0-9.]+\s*%?)/i,
        /([0-9]{2,3}\.[0-9]{1,2})\s*%/,
      ]),
      "number",
    ),
  );
  return f;
}

function extractIncomeCertificate(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];

  // Name: look for common Marathi certificate phrasing before name
  push(
    f,
    field(
      "Name",
      first(text, [
        /(?:this\s+is\s+to\s+certify\s+that|certif\w+\s+that)\s+(?:mr\.?|mrs\.?|ms\.?|श्री|श्रीमती)?\s*([A-Za-z\s.]{4,40}?)(?:\s+s\/o|\s+d\/o|\s+w\/o|\s+resident|,|\n)/i,
        /name[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i,
        /श्री\s*([A-Za-z\s.]{4,40}?)\s+राहणार/i,
        /श्रीमती\s*([A-Za-z\s.]{4,40}?)\s+राहणार/i,
      ]),
    ),
  );

  // Certificate Number: never label this as Aadhaar Number
  push(
    f,
    field(
      "Certificate Number",
      first(text, [
        /(?:जात\s*क्रमांक|certificate\s*no|application\s*no|barcode\s*no|क्रमांक)[:\s]*([A-Z0-9\/\-]+)/i,
        // Long numeric reference codes (10+ digits), but not 12-digit Aadhaar-like numbers
        /\b(\d{10,11})\b/,
      ]),
      "id",
    ),
  );

  // Annual Income: must not match 4-digit year values
  // Uses a lookahead to skip pure years (2000-2024), requires at least 5 digits
  push(
    f,
    field(
      "Annual Income",
      first(text, [
        /(?:annual\s*income|income|उत्पन्न)[:\s]*(?:rs\.?|₹|inr)?\s*([\d,]+(?:\s*(?:lakhs?|lacs?|thousands?|हजार))?)/i,
        /([\d,]{4,8})\s*(?:पन्नास हजार|हजार|lakhs?|lacs?)/i,
        // Standalone 5+ digit number that is NOT a year
        /(?<!\b20\d\d)\b([1-9][\d,]{4,8})\b(?!\s*[-–]\s*\d{2,4})/,
      ]),
      "number",
    ),
  );

  push(
    f,
    field(
      "Financial Year",
      first(text, [
        /(?:financial|assessment)\s*year[:\s]*([\d]{4}[-–]\d{2,4})/i,
        /(?:year|वर्षासाठी)[:\s]*([\d]{4}[-–]\d{2,4})/i,
      ]),
      "date",
    ),
  );

  push(
    f,
    field(
      "Issuing Authority",
      first(text, [
        /issued\s*by[:\s]+([A-Za-z\s,./()-]{3,60}?)(?:\n|$)/i,
        /(?:tehsildar|तहसीलदार)[:\s]+([A-Za-z\u0900-\u097F\s,./()-]{3,60}?)(?:\n|$)/i,
      ]),
    ),
  );

  push(
    f,
    field(
      "Date of Issue",
      first(text, [
        /(?:date|दिनांक)[:\s]*(\d{1,2}[\/\-\.]\s*(?:[A-Za-z\u0900-\u097F]+|\d{1,2})[\/\-\.]\s*\d{2,4})/i,
        /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/,
      ]),
      "date",
    ),
  );

  return f;
}

function extractCasteCertificate(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field("Name", first(text, [/name[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i])),
  );
  push(
    f,
    field(
      "Certificate Number",
      first(text, [
        /certificate\s*(?:no\.?|number)[:\s]*([A-Z0-9\/\-]+)/i,
        /ref(?:erence)?\s*(?:no\.?|number)[:\s]*([A-Z0-9\/\-]+)/i,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Caste / Category",
      first(text, [
        /caste[:\s]+([A-Za-z\s()\-]{3,40}?)(?:\n|$)/i,
        /category[:\s]+([A-Za-z\s()\-]{3,40}?)(?:\n|$)/i,
        /\b(OBC|SC|ST|SBC|DT|NT|VJNT|General|EWS)\b/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Issuing Authority",
      first(text, [
        /(?:issued\s*by|authority)[:\s]+([A-Za-z\s,./()-]{3,60}?)(?:\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Date of Issue",
      first(text, [
        /date\s*of\s*issue[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /dated?[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]),
      "date",
    ),
  );
  return f;
}

function extractGovernmentCertificate(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Name",
      first(text, [
        /name[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i,
        /issued\s+to[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Certificate Number",
      first(text, [
        /certificate\s*(?:no\.?|number)[:\s]*([A-Z0-9\/\-]+)/i,
        /serial\s*(?:no\.?|number)[:\s]*([A-Z0-9\/\-]+)/i,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Certificate Type",
      first(text, [
        /(domicile|bonafide|migration|birth|residence|nationality)\s*certificate/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Issuing Authority",
      first(text, [
        /(?:issued\s*by|authority|office)[:\s]+([A-Za-z\s,./()-]{3,60}?)(?:\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Date of Issue",
      first(text, [
        /date\s*of\s*issue[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /dated?[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]),
      "date",
    ),
  );
  return f;
}

function extractBankStatement(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Account Holder",
      first(text, [
        /account\s+(?:holder|name)[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i,
        /name[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i,
      ]),
    ),
  );
  // Label matches FIELD_INTENT_PATTERNS "Account Number"
  push(
    f,
    field(
      "Account Number",
      first(text, [
        /account\s*(?:number|no\.?)[:\s]*([\d\s]{8,20})/i,
        /a\/c\s*(?:no\.?|number)[:\s]*([\d\s]{8,20})/i,
      ]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Bank Name",
      first(text, [
        /(State Bank of India|HDFC Bank|ICICI Bank|Axis Bank|Kotak(?:\s+Mahindra)? Bank|Punjab National Bank|Bank of Baroda|Union Bank|Canara Bank|Bank of India)/i,
        /bank\s*name[:\s]+([A-Za-z\s]+Bank)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "IFSC Code",
      first(text, [/ifsc[:\s]*([A-Z]{4}0[A-Z0-9]{6})/i]),
      "id",
    ),
  );
  push(
    f,
    field(
      "Branch",
      first(text, [/branch[:\s]+([A-Za-z\s,.-]{3,50}?)(?:\n|$)/i]),
    ),
  );
  push(
    f,
    field(
      "Statement Period",
      first(text, [/(?:statement\s*period|period)[:\s]*([\w\s,–\-]+\d{4})/i]),
      "date",
    ),
  );
  push(
    f,
    field(
      "Closing Balance",
      first(text, [
        /closing\s*balance[:\s]*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d{2})?)/i,
        /available\s*balance[:\s]*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\.\d{2})?)/i,
      ]),
      "number",
    ),
  );
  return f;
}

function extractOfferLetter(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Candidate Name",
      first(text, [
        /dear\s+(?:mr\.?|ms\.?|mrs\.?)?\s*([A-Za-z\s.]{4,40}?)(?:\n|,)/i,
        /name[:\s]+([A-Za-z\s.]{4,40}?)(?:\n|$)/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Company",
      first(text, [
        /company[:\s]+([A-Za-z\s.,()&]{3,60}?)(?:\n|$)/i,
        /^([A-Z][A-Za-z\s,&.'()-]{10,60}(?:Ltd|Pvt|Inc|LLP|Co\.))\s*\n/m,
      ]),
    ),
  );
  push(
    f,
    field(
      "Designation",
      first(text, [
        /designation[:\s]+([A-Za-z\s\-]{3,50}?)(?:\n|$)/i,
        /position[:\s]+([A-Za-z\s\-]{3,50}?)(?:\n|$)/i,
      ]),
    ),
  );
  // Label matches FIELD_INTENT_PATTERNS "CTC / Salary"
  push(
    f,
    field(
      "CTC / Salary",
      first(text, [
        /ctc[:\s]*(?:Rs\.?|₹|INR)?\s*([\d,]+(?:\s*(?:lakh|lakhs?|lac|L|per\s*annum|pa))?)/i,
        /salary[:\s]*(?:Rs\.?|₹|INR)?\s*([\d,]+)/i,
      ]),
      "number",
    ),
  );
  push(
    f,
    field(
      "Joining Date",
      first(text, [
        /joining\s*date[:\s]*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
        /date\s*of\s*joining[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]),
      "date",
    ),
  );
  push(
    f,
    field(
      "Department",
      first(text, [/dept(?:artment)?[:\s]+([A-Za-z\s()\/&.]{3,50}?)(?:\n|$)/i]),
    ),
  );
  return f;
}

function extractGeneric(text: string): ExtractedField[] {
  const f: ExtractedField[] = [];
  push(
    f,
    field(
      "Name",
      first(text, [
        /(?:^|\n)\s*Name[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m,
        /Student\s*Name[:\s]+([A-Z][A-Za-z\s.]{3,40})/i,
      ]),
    ),
  );
  push(
    f,
    field(
      "Date of Birth",
      first(text, [
        /d(?:ate)?\.?\s*of\s*birth[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
        /dob[:\s]*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
      ]),
      "date",
    ),
  );
  push(
    f,
    field(
      "Email",
      first(text, [/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/]),
      "text",
    ),
  );
  push(
    f,
    field(
      "Phone",
      first(text, [
        /(?:mobile|phone|tel|contact)[:\s]*(\+?[\d\s\-]{8,15})/i,
        /\b(\+91[\s\-]?\d{5}[\s\-]?\d{5})\b/,
      ]),
    ),
  );
  push(
    f,
    field("PAN Number", first(text, [/\b([A-Z]{5}[0-9]{4}[A-Z])\b/]), "id"),
  );
  push(
    f,
    field(
      "Address",
      first(text, [/address[:\s]+(.{10,120}?)(?:\n|$)/i]),
      "address",
    ),
  );
  return f;
}

// ─── Category + Theme Mapping ──────────────────────────────────────────────

const DOC_TYPE_TO_CATEGORY: Record<DocumentType, DocumentCategory> = {
  aadhaar_card: "Identity",
  pan_card: "Identity",
  passport: "Identity",
  student_id: "Identity",
  employee_id: "Identity",
  resume: "Career",
  marksheet: "Academic",
  income_certificate: "Government",
  caste_certificate: "Government",
  bank_statement: "Financial",
  offer_letter: "Career",
  government_certificate: "Government",
  generic: "Other",
};

const DOC_TYPE_TO_THEME: Record<
  DocumentType,
  { emoji: string; color: string }
> = {
  aadhaar_card: {
    emoji: "🪢",
    color: "from-orange-500/20 via-amber-500/10 to-yellow-500/5",
  },
  pan_card: {
    emoji: "💳",
    color: "from-yellow-500/20 via-amber-500/10 to-orange-500/5",
  },
  passport: {
    emoji: "🛂",
    color: "from-blue-500/20 via-indigo-500/10 to-violet-500/5",
  },
  student_id: {
    emoji: "🎓",
    color: "from-emerald-500/20 via-green-500/10 to-teal-500/5",
  },
  employee_id: {
    emoji: "🏢",
    color: "from-cyan-500/20 via-sky-500/10 to-blue-500/5",
  },
  resume: {
    emoji: "💼",
    color: "from-blue-500/20 via-cyan-500/10 to-sky-500/5",
  },
  marksheet: {
    emoji: "📊",
    color: "from-green-500/20 via-emerald-500/10 to-teal-500/5",
  },
  income_certificate: {
    emoji: "🏛️",
    color: "from-red-500/20 via-rose-500/10 to-pink-500/5",
  },
  caste_certificate: {
    emoji: "📜",
    color: "from-red-500/20 via-rose-500/10 to-pink-500/5",
  },
  bank_statement: {
    emoji: "🏦",
    color: "from-amber-500/20 via-yellow-500/10 to-lime-500/5",
  },
  offer_letter: {
    emoji: "✉️",
    color: "from-blue-500/20 via-cyan-500/10 to-sky-500/5",
  },
  government_certificate: {
    emoji: "📋",
    color: "from-red-500/20 via-rose-500/10 to-pink-500/5",
  },
  generic: { emoji: "📄", color: "from-brand/20 via-brand/10 to-transparent" },
};

function buildTags(docType: DocumentType, textLower: string): string[] {
  const tags: Set<string> = new Set([docType.replace(/_/g, " ")]);
  if (docType === "aadhaar_card") {
    tags.add("aadhaar");
    tags.add("identity");
  }
  if (docType === "pan_card") {
    tags.add("pan");
    tags.add("tax");
    tags.add("identity");
  }
  if (docType === "passport") {
    tags.add("passport");
    tags.add("travel");
    tags.add("identity");
  }
  if (docType === "student_id" || docType === "employee_id") {
    tags.add("id card");
    tags.add("identity");
  }
  if (docType === "resume") {
    tags.add("resume");
    tags.add("cv");
    tags.add("career");
  }
  if (docType === "marksheet") {
    tags.add("academic");
    tags.add("marks");
    tags.add("result");
  }
  if (docType === "bank_statement") {
    tags.add("banking");
    tags.add("finance");
  }
  if (docType === "offer_letter") {
    tags.add("offer");
    tags.add("employment");
    tags.add("career");
  }
  if (docType.includes("certificate")) {
    tags.add("certificate");
    tags.add("government");
  }
  if (textLower.includes("cgpa") || textLower.includes("sgpa")) tags.add("gpa");
  return [...tags];
}

// ─── Main Export ────────────────────────────────────────────────────────────

export function parseExtractedText(
  rawText: string,
  filename: string,
): ParseResult {
  const text = rawText.trim();
  const textLower = text.toLowerCase();

  const docType = detectDocumentType(text, filename);

  let extractedFields: ExtractedField[];
  switch (docType) {
    case "aadhaar_card":
      extractedFields = extractAadhaar(text);
      break;
    case "pan_card":
      extractedFields = extractPAN(text);
      break;
    case "passport":
      extractedFields = extractPassport(text);
      break;
    case "student_id":
      extractedFields = extractStudentID(text);
      break;
    case "employee_id":
      extractedFields = extractEmployeeID(text);
      break;
    case "resume":
      extractedFields = extractResume(text);
      break;
    case "marksheet":
      extractedFields = extractMarksheet(text);
      break;
    case "income_certificate":
      extractedFields = extractIncomeCertificate(text);
      break;
    case "caste_certificate":
      extractedFields = extractCasteCertificate(text);
      break;
    case "bank_statement":
      extractedFields = extractBankStatement(text);
      break;
    case "offer_letter":
      extractedFields = extractOfferLetter(text);
      break;
    case "government_certificate":
      extractedFields = extractGovernmentCertificate(text);
      break;
    default:
      extractedFields = extractGeneric(text);
      break;
  }

  const category = DOC_TYPE_TO_CATEGORY[docType];
  const theme = DOC_TYPE_TO_THEME[docType];
  const tags = buildTags(docType, textLower);

  const nameField = extractedFields.find(
    (f) =>
      f.label === "Name" ||
      f.label === "Candidate Name" ||
      f.label === "Account Holder",
  );
  const idField = extractedFields.find((f) => f.fieldType === "id");
  const typeLabel = docType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  let summary = `${typeLabel} document processed successfully.`;
  if (nameField) summary = `${nameField.value}'s ${typeLabel}.`;
  if (idField) summary += ` ${idField.label}: ${idField.value}.`;
  if (extractedFields.length > 1) {
    summary += ` Extracted ${extractedFields.length} fields: ${extractedFields
      .slice(0, 4)
      .map((f) => f.label)
      .join(", ")}.`;
  }

  return {
    category,
    documentType: docType,
    thumbnailEmoji: theme.emoji,
    thumbnailColor: theme.color,
    tags,
    extractedFields,
    summary,
  };
}
