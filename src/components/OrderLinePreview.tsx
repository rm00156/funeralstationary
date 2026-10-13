"use client";

import { useCallback, useState } from "react";
import { Eye } from "lucide-react";

import DesignPreviewDialog, { type PreviewMode } from "@/components/DesignPreviewDialog";
import { StaticPage } from "@/components/PageCanvas";
import { docTrim, pageMetrics, printedPageLabels, type DesignDoc } from "@/lib/designEditor";

const COVER_HEIGHT = 112;

/**
 * An order line's front, and the editor's own preview of every page behind
 * it. Drawn from the line's doc_snapshot — what was paid for — never the live
 * design (which may have been edited since) and never a proof (a press
 * artefact, admin-only).
 */
export default function OrderLinePreview({ doc, name }: { doc: DesignDoc; name: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<PreviewMode>("pages");
  const close = useCallback(() => setOpen(false), []);
  const trim = docTrim(doc);
  const labels = printedPageLabels(doc.pages.length);

  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Preview ${name}`}
        className="overflow-hidden rounded border border-line shadow-cover transition-shadow hover:shadow-cover-hover"
      >
        <StaticPage
          page={doc.pages[0]}
          trim={trim}
          scale={COVER_HEIGHT / pageMetrics(trim).pageH}
          plain
        />
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 items-center gap-1.5 px-1 font-body text-sm font-medium text-plum hover:text-plum-deep"
      >
        <Eye size={16} aria-hidden />
        Preview
      </button>
      {open && (
        <DesignPreviewDialog
          title={name}
          pages={doc.pages}
          trim={trim}
          pageLabel={(index) => labels[index] ?? `Page ${index + 1}`}
          mode={mode}
          onModeChange={setMode}
          onClose={close}
        />
      )}
    </div>
  );
}
