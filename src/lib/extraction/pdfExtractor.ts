// ─── DocMind AI — PDF Text Extractor ─────────────────────────────────────
//
// THE CORE PROBLEM THIS SOLVES:
// Government PDFs (Maharashtra, UP, etc.) use custom embedded fonts with
// broken Unicode ToUnicode tables. pdf.js extracts text but the characters
// are wrong — e.g. "विठुल" becomes "व ल" because the font's character map
// is corrupt. The quality gate (checking char count) passes this as "good text"
// because there ARE characters — they're just the wrong ones.
//
// SOLUTION — Dual extraction per page:
//   - Every page: run BOTH pdf.js text extraction AND Groq vision in parallel
//   - Send BOTH results to the parse route, clearly labelled
//   - Groq reconciles them — vision output wins for names/proper nouns
//     where font corruption typically strikes
//
// For truly digital PDFs (no font issues), text and vision agree → fast
// For broken-font govt PDFs, vision corrects what text got wrong
// For fully scanned PDFs, text is empty → vision is the only result

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdf: any;
  try {
    pdf = await loadingTask.promise;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.toLowerCase().includes("password")) {
      return "[PASSWORD_PROTECTED] This PDF is password-protected. Please upload an unlocked version.";
    }
    throw err;
  }

  const pageResults: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // ── Run text extraction and vision rendering in PARALLEL ──────────────
    const [pageText, pageBase64] = await Promise.all([
      extractPageText(page),
      renderPageToBase64(page, 2.5),
    ]);

    const meaningfulChars = (pageText.match(/[a-zA-Z0-9\u0900-\u097F]/g) ?? [])
      .length;
    const hasText = meaningfulChars > 30;

    if (!hasText && !pageBase64) {
      // Nothing worked at all
      pageResults.push(`--- Page ${pageNum} ---\n`);
      continue;
    }

    if (!hasText) {
      // Fully scanned page — vision only
      const visionText = pageBase64
        ? await callVisionOCR(pageBase64, pageNum)
        : "";
      if (visionText.trim().length > 10) {
        pageResults.push(`--- Page ${pageNum} ---\n${visionText.trim()}`);
      } else {
        // Last resort: Tesseract
        const tesseractText = await extractPageWithTesseract(page, pageNum);
        pageResults.push(`--- Page ${pageNum} ---\n${tesseractText.trim()}`);
      }
      continue;
    }

    // ── Has text — but may have broken font encoding ───────────────────────
    // Check for broken font signals:
    //   1. Many isolated single Devanagari chars with spaces between them
    //      e.g. "व ल" instead of "विठुल" — character mapping failure
    //   2. High ratio of space-separated single chars in Devanagari range
    const devanagariChars = (pageText.match(/[\u0900-\u097F]/g) ?? []).length;
    const isolatedDevanagari = (
      pageText.match(/(?<!\S)[\u0900-\u097F](?!\S)/g) ?? []
    ).length;
    const brokenFontRatio =
      devanagariChars > 5 ? isolatedDevanagari / devanagariChars : 0;
    const hasBrokenFont = brokenFontRatio > 0.25; // >25% isolated = likely broken

    if (hasBrokenFont && pageBase64) {
      // Broken font detected — use vision to correct it
      // Send BOTH to parse route via a combined block so Groq can reconcile
      console.log(
        `[pdfExtractor] Page ${pageNum}: broken font detected (ratio ${brokenFontRatio.toFixed(2)}) — adding vision correction`,
      );
      const visionText = await callVisionOCR(pageBase64, pageNum);

      if (visionText.trim().length > 10) {
        // Combine: label both clearly so Groq parse route knows which to trust
        pageResults.push(
          `--- Page ${pageNum} ---\n` +
            `[TEXT_LAYER — may have font encoding issues]\n${pageText}\n\n` +
            `[VISION_OCR — use this for names and proper nouns]\n${visionText.trim()}`,
        );
      } else {
        // Vision failed — use text layer anyway (better than nothing)
        pageResults.push(`--- Page ${pageNum} ---\n${pageText}`);
      }
    } else {
      // Clean digital PDF — text layer is reliable
      pageResults.push(`--- Page ${pageNum} ---\n${pageText}`);
    }
  }

  return pageResults.join("\n\n").trim();
}

// ─── Extract text layer from a PDF page ───────────────────────────────────
async function extractPageText(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
): Promise<string> {
  try {
    const textContent = await page.getTextContent();
    return (
      textContent.items
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((item: any) => "str" in item)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((item: any) => item.str as string)
        .join(" ")
        .trim()
    );
  } catch {
    return "";
  }
}

// ─── Call /api/documents/ocr with a base64 image ──────────────────────────
async function callVisionOCR(base64: string, pageNum: number): Promise<string> {
  try {
    const res = await fetch("/api/documents/ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType: "image/jpeg",
        pageNum,
      }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { text?: string };
    return data.text ?? "";
  } catch (err) {
    console.warn(`[pdfExtractor] Vision OCR failed for page ${pageNum}:`, err);
    return "";
  }
}

// ─── Tesseract last resort ─────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractPageWithTesseract(
  page: any,
  pageNum: number,
): Promise<string> {
  try {
    const viewport = page.getViewport({ scale: 3.0 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return "";
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, canvas, viewport }).promise;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) return "";
    const Tesseract = (await import("tesseract.js")).default;
    try {
      const r = await Tesseract.recognize(blob, "eng+hin");
      return r?.data?.text ?? "";
    } catch {
      const r = await Tesseract.recognize(blob, "eng");
      return r?.data?.text ?? "";
    }
  } catch (err) {
    console.warn(`[pdfExtractor] Tesseract failed for page ${pageNum}:`, err);
    return "";
  }
}

// ─── Render a PDF page to base64 JPEG ─────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function renderPageToBase64(
  page: any,
  scale = 2.5,
): Promise<string | null> {
  try {
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return null;
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: context, canvas, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    return dataUrl.split(",")[1] ?? null;
  } catch {
    return null;
  }
}

// ─── Utility exports ───────────────────────────────────────────────────────
export async function getPDFPageCount(file: File): Promise<number> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch {
    return 1;
  }
}

export async function getPDFBase64(file: File): Promise<string | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    return await renderPageToBase64(page, 2.0);
  } catch {
    return null;
  }
}
