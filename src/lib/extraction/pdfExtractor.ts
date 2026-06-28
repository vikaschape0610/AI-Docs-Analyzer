// ─── DocMind AI — Client-Side PDF Text Extractor ─────────────────────────
// Extracts raw text from PDF files in the browser using pdf.js.
// No backend required. Works with any PDF file.
//
// BACKEND INTEGRATION: Replace this with a server-side endpoint that:
//   1. Runs Tesseract OCR for scanned PDFs
//   2. Runs a language model for intelligent extraction
//   3. Returns structured JSON with extractedInfo fields

/**
 * Extracts all text from a PDF File object.
 * Returns the raw text concatenated from all pages.
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  // Dynamic import to avoid SSR issues
  const pdfjsLib = await import("pdfjs-dist");

  // Set the worker source - use the bundled worker
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();

  // Load the PDF document
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const textParts: string[] = [];

  // Extract text from each page
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // Join all text items on this page
    const pageText = textContent.items
      .filter((item): item is import("pdfjs-dist/types/src/display/api").TextItem =>
        "str" in item
      )
      .map((item) => item.str)
      .join(" ");

    textParts.push(`--- Page ${pageNum} ---\n${pageText}`);
  }

  let finalRawText = textParts.join("\n\n").trim();

  // --- Scanned PDF Fallback ---
  // If the PDF yielded almost no text, it's likely a scanned image.
  // We'll render the first page to a canvas and run Tesseract on it.
  if (finalRawText.length < 50) {
    console.log("PDF yielded low text volume. Attempting OCR fallback...");
    try {
      const pageNum = 1; // Try OCR on the first page
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better OCR
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      
      if (context) {
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;
        
        // Convert canvas to blob
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        
        if (blob) {
          const Tesseract = (await import("tesseract.js")).default;
          const ocrResult = await Tesseract.recognize(blob, "eng");
          if (ocrResult && ocrResult.data && ocrResult.data.text) {
             finalRawText += "\n" + ocrResult.data.text;
          }
        }
      }
    } catch (ocrErr) {
      console.warn("OCR fallback failed for scanned PDF:", ocrErr);
    }
  }

  return finalRawText;
}

/**
 * Counts the number of pages in a PDF.
 */
export async function getPDFPageCount(file: File): Promise<number> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch {
    return 1;
  }
}

/**
 * Renders the first page of a PDF and returns it as a base64 JPEG string.
 */
export async function getPDFBase64(file: File): Promise<string | null> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
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
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      // Remove the "data:image/jpeg;base64," prefix
      return dataUrl.split(",")[1];
    }
  } catch (err) {
    console.warn("Failed to generate PDF base64:", err);
  }
  return null;
}
