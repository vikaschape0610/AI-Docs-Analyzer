import mammoth from "mammoth";

export async function extractTextFromDocx(
  file: File
): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();

    const result = await mammoth.extractRawText({
      arrayBuffer,
    });

    return result.value || "";
  } catch (error) {
    console.error("DOCX extraction failed:", error);
    return "";
  }
}