// ─── DocMind AI — Image OCR Extractor ────────────────────────────────────
// Extracts text from image files using Tesseract.js.
// Improvements over v1:
//   - Supports Hindi + English (eng+hin) for Indian documents
//   - Falls back to English-only if multi-language pack unavailable
//   - Higher DPI canvas rendering for small/low-quality images
//   - Returns quality metadata for downstream quality gate

import Tesseract from "tesseract.js";

export interface ImageExtractionResult {
  text: string;
  confidence: number; // 0–100, from Tesseract
  language: string; // which language pack was used
}

/**
 * Extracts text from an image File using Tesseract OCR.
 * Tries Hindi+English first (covers Indian documents), falls back to English.
 */
export async function extractTextFromImage(file: File): Promise<string> {
  const result = await extractTextFromImageWithMeta(file);
  return result.text;
}

export async function extractTextFromImageWithMeta(
  file: File,
): Promise<ImageExtractionResult> {
  // Try to upscale small images for better OCR accuracy
  const processedBlob = await upscaleIfNeeded(file);

  // Attempt Hindi + English (covers Aadhaar, income certs, Marathi govt docs)
  try {
    const result = await Tesseract.recognize(processedBlob, "eng+hin");
    const text = result?.data?.text ?? "";
    const confidence = result?.data?.confidence ?? 0;

    if (text.trim().length > 10) {
      return { text: text.trim(), confidence, language: "eng+hin" };
    }
  } catch {
    // eng+hin traineddata not loaded; fall through to English-only
  }

  // Fallback: English only
  try {
    const result = await Tesseract.recognize(processedBlob, "eng");
    const text = result?.data?.text ?? "";
    const confidence = result?.data?.confidence ?? 0;
    return { text: text.trim(), confidence, language: "eng" };
  } catch (error) {
    console.error("[imageExtractor] OCR failed:", error);
    return { text: "", confidence: 0, language: "eng" };
  }
}

/**
 * If the image is small (< 800px on any side), render it at 2× on a canvas
 * to improve Tesseract recognition accuracy.
 */
async function upscaleIfNeeded(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // Only upscale if image is small
    if (width >= 800 && height >= 800) {
      bitmap.close();
      return file;
    }

    const scale = Math.min(3.0, Math.max(2.0, 1600 / Math.max(width, height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }

    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      ),
    );
  } catch {
    return file;
  }
}
