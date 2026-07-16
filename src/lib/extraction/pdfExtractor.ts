// ─── DocMind AI — PDF Text Extractor ─────────────────────────────────────
//
// PIPELINE per page:
//   1. Extract text layer via pdf.js (fast, perfect for digital PDFs)
//   2. Quality gate — is the text meaningful?
//      YES → use text layer directly
//      NO (scanned) → render page → vision OCR → Tesseract fallback
//   3. Broken font detection — Marathi/Hindi govt PDFs with bad ToUnicode
//      If broken → pass BOTH text + base64 image to parse route
//      so Groq vision can correct names/proper nouns
//
// NOTE: renderPageToBase64 is called ONLY when broken font is detected
// or when the page has no text (scanned). NOT for every clean page.

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

    // Step 1: Try text layer extraction
    const pageText = await extractPageText(page);
    const meaningfulChars = (pageText.match(/[a-zA-Z0-9\u0900-\u097F]/g) ?? [])
      .length;
    const hasText = meaningfulChars > 30;

    if (!hasText) {
      // Fully scanned page — render and use vision/Tesseract
      const base64 = await renderPageToBase64(page, 2.5);
      const visionText = base64 ? await callVisionOCR(base64, pageNum) : "";

      if (visionText.trim().length > 10) {
        pageResults.push(`--- Page ${pageNum} ---\n${visionText.trim()}`);
      } else {
        const tesseractText = await extractPageWithTesseract(page, pageNum);
        if (tesseractText.trim().length > 5) {
          pageResults.push(`--- Page ${pageNum} ---\n${tesseractText.trim()}`);
        } else {
          pageResults.push(`--- Page ${pageNum} ---\n`);
        }
      }
      continue;
    }

    // Step 2: Broken font detection
    // Marathi/Hindi govt PDFs have broken ToUnicode — multi-char words split into single chars
    // e.g. "विठुल" → "व ि ठ ु ल" → lots of single-char Devanagari "words"
    const devanagariWords = pageText.match(/[\u0900-\u097F]+/g) ?? [];
    const singleCharWords = devanagariWords.filter(
      (w) => [...w].length === 1,
    ).length;
    const wordRatio =
      devanagariWords.length > 3 ? singleCharWords / devanagariWords.length : 0;
    // >= 0.18: 1 in 5 Devanagari words is single-char = broken font (income cert had 0.23)
    const hasBrokenFont = wordRatio >= 0.18;

    if (hasBrokenFont) {
      console.log(
        `[pdfExtractor] Page ${pageNum}: broken font (ratio ${wordRatio.toFixed(2)}) — adding vision layer`,
      );
      // Render page for vision correction
      const base64 = await renderPageToBase64(page, 2.5);
      const visionText = base64 ? await callVisionOCR(base64, pageNum) : "";

      if (visionText.trim().length > 10) {
        // Send BOTH — Groq parse route will reconcile (vision wins for names)
        pageResults.push(
          `--- Page ${pageNum} ---\n` +
            `[TEXT_LAYER — may have font encoding issues]\n${pageText}\n\n` +
            `[VISION_OCR — use this for names and proper nouns]\n${visionText.trim()}`,
        );
      } else {
        // Vision unavailable — still send text layer, Groq will do its best
        console.warn(
          `[pdfExtractor] Vision unavailable for page ${pageNum}, using text layer only`,
        );
        pageResults.push(`--- Page ${pageNum} ---\n${pageText}`);
      }
    } else {
      // Clean digital PDF — text layer is fully reliable
      pageResults.push(`--- Page ${pageNum} ---\n${pageText}`);
    }
  }

  return pageResults.join("\n\n").trim();
}

// ─── Extract text layer ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractPageText(page: any): Promise<string> {
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

// ─── Call Groq vision OCR API ──────────────────────────────────────────────
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
    const data = (await res.json()) as { text?: string; error?: string };
    if (data.error) {
      console.warn(
        `[pdfExtractor] Vision OCR error page ${pageNum}:`,
        data.error,
      );
      return "";
    }
    return data.text ?? "";
  } catch (err) {
    console.warn(
      `[pdfExtractor] Vision OCR fetch failed page ${pageNum}:`,
      err,
    );
    return "";
  }
}

// ─── Tesseract fallback ────────────────────────────────────────────────────
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
    console.warn(`[pdfExtractor] Tesseract failed page ${pageNum}:`, err);
    return "";
  }
}

// ─── Render page to base64 JPEG ────────────────────────────────────────────
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

// ─── Utilities ─────────────────────────────────────────────────────────────
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
