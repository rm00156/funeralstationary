"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { previewGroups, type PreviewGroup } from "@/lib/artwork";
import type { PageTrim, TemplatePageCount } from "@/lib/designEditor";
import { renderPage, type PDFDocumentProxy } from "@/lib/pdfPreview";

const THUMB_HEIGHT = 168;

/** One page of the customer's PDF, drawn by pdf.js at a fixed CSS height. */
function PdfPageImage({
  doc,
  page,
  height,
  aspect,
}: {
  doc: PDFDocumentProxy;
  page: number;
  height: number;
  /** width / height, for the space the page takes before it has drawn. */
  aspect: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const job = renderPage(doc, page, canvas, height);
    job.done.catch((error: unknown) => {
      if ((error as { name?: string } | null)?.name !== "RenderingCancelledException") setFailed(true);
    });
    return job.cancel;
  }, [doc, page, height]);

  if (failed) {
    return (
      <span
        className="flex items-center justify-center bg-surface text-sm text-ink-3"
        style={{ height, width: Math.round(height * aspect) }}
      >
        Page {page}
      </span>
    );
  }
  return (
    <canvas
      ref={canvasRef}
      // Placeholder size until pdf.js sets the real one; CSS keeps the height.
      width={Math.round(height * aspect)}
      height={height}
      className="block bg-surface"
      style={{ height, width: "auto" }}
      aria-hidden
    />
  );
}

/**
 * The upload flow's preview: the customer's own pages, laid out as they'll
 * hold them (previewGroups), each opening up large enough to proofread —
 * "We print exactly what you send us" is only fair if they can read it.
 */
export default function PdfPagePreview({
  doc,
  pageCount,
  templatePages,
  trim,
}: {
  doc: PDFDocumentProxy;
  pageCount: number;
  templatePages: TemplatePageCount;
  trim: PageTrim;
}) {
  const groups = previewGroups(pageCount, templatePages);
  const aspect = trim.widthMm / trim.heightMm;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [bigHeight, setBigHeight] = useState(600);

  const show = (index: number) => {
    const group = groups[index];
    // As tall as the screen allows, unless a spread would then be too wide.
    const byHeight = window.innerHeight * 0.7;
    const byWidth = (window.innerWidth - 64) / (group.pages.length * aspect);
    setBigHeight(Math.max(200, Math.round(Math.min(byHeight, byWidth, 1000))));
    setOpen(index);
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
  };

  const current: PreviewGroup | null = open === null ? null : groups[open];

  return (
    <>
      <ul className="flex flex-wrap gap-x-6 gap-y-6">
        {groups.map((group, index) => (
          <li key={group.label}>
            <button
              type="button"
              onClick={() => show(index)}
              className="group flex flex-col items-center gap-2.5 rounded-lg p-1 text-[15px] text-ink-2"
              aria-label={`${group.label} — view larger`}
            >
              <span className="cover flex group-hover:-translate-y-1 group-hover:shadow-cover-hover">
                {group.pages.map((page) => (
                  <PdfPageImage key={page} doc={doc} page={page} height={THUMB_HEIGHT} aspect={aspect} />
                ))}
              </span>
              <span>{group.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        aria-label={current ? `${current.label}, larger` : "Page preview"}
        className="m-auto max-h-[calc(100vh-24px)] max-w-[calc(100vw-24px)] rounded-xl bg-paper p-0 text-ink backdrop:bg-plum-night/70"
      >
        {current && open !== null && (
          <div className="type-body flex flex-col items-center gap-4 p-5">
            <div className="flex w-full items-center justify-between gap-4">
              <p className="font-display text-2xl">{current.label}</p>
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className="btn btn-ghost px-3"
                aria-label="Close"
              >
                <X size={22} aria-hidden />
              </button>
            </div>
            <div className="flex shadow-cover">
              {current.pages.map((page) => (
                <PdfPageImage key={page} doc={doc} page={page} height={bigHeight} aspect={aspect} />
              ))}
            </div>
            <div className="flex w-full justify-between gap-4">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={open === 0}
                onClick={() => show(open - 1)}
              >
                <ChevronLeft size={20} aria-hidden />
                Previous
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={open === groups.length - 1}
                onClick={() => show(open + 1)}
              >
                Next
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
