import { loadPdfjs } from './pdfjsLoader';
import { decodeQRCodeFromCanvas } from './qrDecoder';

/**
 * Scans a PDF file for QR codes across all pages
 * @param {File | Blob | ArrayBuffer} file
 * @param {Function} onProgress - callback (currentPage, totalPages)
 * @returns {Promise<{totalPages: number, detectedCodes: Array<{page: number, totalPages: number, rawValue: string, format: string, thumbnail: string, fullImage: string}>}>}
 */
export async function scanPDFForQRCodes(file, onProgress) {
  let arrayBuffer;
  if (file instanceof ArrayBuffer) {
    arrayBuffer = file;
  } else {
    arrayBuffer = await file.arrayBuffer();
  }

  const pdfjsLib = await loadPdfjs();
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const detectedCodes = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, numPages);
    }

    const page = await pdf.getPage(pageNum);
    // Render at 2x scale for crisp QR code detection
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    const qrResult = await decodeQRCodeFromCanvas(canvas);

    // Also generate a small thumbnail for the page preview
    const thumbCanvas = document.createElement('canvas');
    const thumbScale = 0.25;
    thumbCanvas.width = canvas.width * thumbScale;
    thumbCanvas.height = canvas.height * thumbScale;
    const thumbCtx = thumbCanvas.getContext('2d');
    thumbCtx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    const thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.6);

    if (qrResult) {
      detectedCodes.push({
        page: pageNum,
        totalPages: numPages,
        rawValue: qrResult.rawValue,
        format: qrResult.format,
        thumbnail: thumbnail,
        fullImage: canvas.toDataURL('image/jpeg', 0.75)
      });
    }
  }

  return {
    totalPages: numPages,
    detectedCodes: detectedCodes
  };
}
