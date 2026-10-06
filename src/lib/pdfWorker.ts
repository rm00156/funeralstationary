/**
 * The pdf.js worker's entry. pdf.js's worker initialises itself when it finds
 * it is running inside a Worker, so importing it is all this does; it lives
 * here so pdfPreview.ts can start it with a relative `new URL(…, import.meta
 * .url)`, which both bundlers turn into a worker chunk.
 */
import "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
