// ─── DocMind AI — Client-Side PDF Text Extractor ─────────────────────────
// Extracts raw text from PDF files in the browser using pdf.js.
// Improvements over v1:
//   - Multi-page OCR (all pages, not just page 1)
//   - Smarter quality gate (meaningful chars, not just length)
//   - Higher scale (3.0) for better OCR resolution
//   - Hindi/Marathi support via eng+hin language pack
//   - OCR output replaces bad text (not appends to it)

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");

  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pageResults: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .filter(
        (item): item is import("pdfjs-dist/types/src/display/api").TextItem =>
          "str" in item,
      )
      .map((item) => item.str)
      .join(" ")
      .trim();

    // Quality gate: check for meaningful alphanumeric content, not just length.
    // A page full of spaces or pdf.js artifacts (zero-width chars, lone symbols)
    // will fail this check and trigger OCR.
    const meaningfulChars = (pageText.match(/[a-zA-Z0-9\u0900-\u097F]/g) ?? [])
      .length;
    const isMeaningful = meaningfulChars > 30;

    if (isMeaningful) {
      pageResults.push(`--- Page ${pageNum} ---\n${pageText}`);
    } else {
      // Scanned page — run OCR on this specific page
      console.log(
        `[pdfExtractor] Page ${pageNum}: low quality text (${meaningfulChars} chars), attempting OCR...`,
      );
      try {
        const viewport = page.getViewport({ scale: 3.0 }); // ~300 DPI equivalent
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;

          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, "image/png"),
          );

          if (blob) {
            const Tesseract = (await import("tesseract.js")).default;
            // Try Hindi + English for Indian documents; fall back to English-only
            let ocrText = "";
            try {
              const ocrResult = await Tesseract.recognize(blob, "eng+hin");
              ocrText = ocrResult?.data?.text ?? "";
            } catch {
              // If eng+hin pack not available, fall back to eng
              const ocrResult = await Tesseract.recognize(blob, "eng");
              ocrText = ocrResult?.data?.text ?? "";
            }

            if (ocrText.trim().length > 10) {
              pageResults.push(`--- Page ${pageNum} ---\n${ocrText.trim()}`);
            }
          }
        }
      } catch (ocrErr) {
        console.warn(`[pdfExtractor] OCR failed for page ${pageNum}:`, ocrErr);
        // Push empty page marker so chunker page numbering stays consistent
        pageResults.push(`--- Page ${pageNum} ---\n`);
      }
    }
  }

  return pageResults.join("\n\n").trim();
}

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
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (context) {
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      await page.render({ canvasContext: context, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      return dataUrl.split(",")[1];
    }
  } catch (err) {
    console.warn("[pdfExtractor] Failed to generate PDF base64:", err);
  }
  return null;
}
