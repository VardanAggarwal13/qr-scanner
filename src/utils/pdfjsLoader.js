// PDF.js is ~1 MB+ of code, and only PDF viewers need it. It is loaded on demand (and can be
// warmed up at startup in parallel with React rendering) instead of being part of the main bundle.
// The legacy build runs on older phone browsers (Samsung/Opera/MIUI/WebView) the modern build breaks on.
let pdfjsPromise;

export function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

/**
 * Bytes of the PDF the page already started downloading from an inline script in index.html,
 * so the file transfer overlaps with the JavaScript download instead of waiting for it.
 */
export function takePrefetchedFile(url) {
  const pre = typeof window !== 'undefined' ? window.__qrPre : null;
  if (pre && pre.url === url) {
    window.__qrPre = null;
    return pre.p;
  }
  return null;
}
