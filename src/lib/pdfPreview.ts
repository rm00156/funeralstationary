/**
 * Browser-only PDF rendering for the upload flow's preview, via pdf.js.
 *
 * The preview is drawn from the customer's own file, already in the browser,
 * so nothing is fetched back from storage and the server renders nothing.
 * pdf.js is ~1MB, so it is loaded on first use rather than with the page. The
 * legacy build is deliberate: the modern one needs browsers newer than many
 * of this site's customers have.
 *
 * Only what the customer *sees* comes from here. Whether the file is fit to
 * print is decided on the server from the uploaded bytes (pdfAnalysis.ts) —
 * the page count read here is for the file card, not a check.
 */
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";

export type { PDFDocumentProxy };

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

let loading: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  loading ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL("./pdfWorker.ts", import.meta.url), {
      type: "module",
    });
    return pdfjs;
  });
  return loading;
}

/** Open a chosen file. The caller destroys the document when it is done with it. */
export async function openPdf(file: Blob): Promise<PDFDocumentProxy> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

/**
 * Draw one page into a canvas `cssHeight` pixels tall, sharp on high-density
 * screens. Returns a cancel function for an unmounting thumbnail.
 */
export function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssHeight: number,
): { done: Promise<{ width: number; height: number }>; cancel: () => void } {
  let task: RenderTask | null = null;
  let cancelled = false;
  const done = doc.getPage(pageNumber).then(async (page) => {
    const base = page.getViewport({ scale: 1 });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const viewport = page.getViewport({ scale: (cssHeight * ratio) / base.height });
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const size = { width: viewport.width / ratio, height: viewport.height / ratio };
    if (cancelled) return size;
    task = page.render({ canvas, viewport });
    await task.promise;
    return size;
  });
  return {
    done,
    cancel: () => {
      cancelled = true;
      task?.cancel();
    },
  };
}

/** Let go of a document and its worker-side copy of the file. */
export function closePdf(doc: PDFDocumentProxy): void {
  void doc.loadingTask.destroy();
}
