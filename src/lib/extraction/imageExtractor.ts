import Tesseract from "tesseract.js";

export async function extractTextFromImage(
  file: File
): Promise<string> {
  try {
    const result = await Tesseract.recognize(
      file,
      "eng"
    );

    return result.data.text || "";
  } catch (error) {
    console.error("OCR failed:", error);
    return "";
  }
}