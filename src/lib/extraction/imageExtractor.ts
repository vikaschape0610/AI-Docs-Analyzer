// ─── DocMind AI — Image Text Extractor ───────────────────────────────────
// Extracts text from image files (JPG, PNG, WEBP, etc.)
//
// Pipeline:
//   1. Convert image to base64
//   2. Send to /api/documents/ocr (Groq vision — handles any language)
//   3. If vision fails, fall back to Tesseract (eng+hin, then eng)
//
// This handles: scanned Aadhaar, PAN photos, income certs, any language

/**
 * Primary export — extracts text from an image file.
 * Uses Groq vision as primary, Tesseract as fallback.
 */
export async function extractTextFromImage(file: File): Promise<string> {
  // Step 1: Try Groq vision (far superior for any language, any script)
  try {
    const base64 = await fileToBase64(file);
    if (base64) {
      const res = await fetch("/api/documents/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType: file.type || "image/jpeg",
          pageNum: 1,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { text?: string; error?: string };
        const visionText = data.text?.trim() ?? "";
        if (visionText.length > 10) {
          console.log(
            `[imageExtractor] Groq vision extracted ${visionText.length} chars from ${file.name}`,
          );
          return visionText;
        }
      }
    }
  } catch (err) {
    console.warn("[imageExtractor] Groq vision failed, trying Tesseract:", err);
  }

  // Step 2: Tesseract fallback
  return await extractWithTesseract(file);
}

// ─── Convert File to base64 string ────────────────────────────────────────
async function fileToBase64(file: File): Promise<string | null> {
  try {
    // Upscale small images before sending to Groq for better recognition
    const processedBlob = await upscaleIfNeeded(file);

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Strip the data URL prefix — only send the base64 part
        const base64 = result.split(",")[1];
        resolve(base64 ?? null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(processedBlob);
    });
  } catch {
    return null;
  }
}

// ─── Upscale small images for better recognition ──────────────────────────
async function upscaleIfNeeded(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // If image is already large enough, return as-is
    if (width >= 1000 && height >= 1000) {
      bitmap.close();
      return file;
    }

    // Scale so the longer side is at least 1600px
    const scale = Math.min(4.0, Math.max(1.5, 1600 / Math.max(width, height)));
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
        "image/jpeg",
        0.92,
      ),
    );
  } catch {
    return file;
  }
}

// ─── Tesseract fallback ────────────────────────────────────────────────────
async function extractWithTesseract(file: File): Promise<string> {
  try {
    const processedBlob = await upscaleIfNeeded(file);
    const Tesseract = (await import("tesseract.js")).default;

    // Try Hindi + English first (covers Indian documents)
    try {
      const result = await Tesseract.recognize(processedBlob, "eng+hin");
      const text = result?.data?.text?.trim() ?? "";
      if (text.length > 10) {
        console.log(
          `[imageExtractor] Tesseract (eng+hin) extracted ${text.length} chars`,
        );
        return text;
      }
    } catch {
      // eng+hin traineddata not available
    }

    // Final fallback: English only
    const result = await Tesseract.recognize(processedBlob, "eng");
    return result?.data?.text?.trim() ?? "";
  } catch (err) {
    console.error("[imageExtractor] All OCR methods failed:", err);
    return "";
  }
}
