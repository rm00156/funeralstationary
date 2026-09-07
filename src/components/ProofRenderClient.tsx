"use client";

import { useEffect, useRef, useState } from "react";

import { PageCanvas } from "@/components/DesignEditor";
import {
  ARTBOARD_H_MM,
  ARTBOARD_W_MM,
  PRINT_ZOOM,
  type DesignDoc,
} from "@/lib/designEditor";

declare global {
  interface Window {
    /** Set by the Puppeteer job via page.evaluate() before it fires "proof-data-ready". */
    __PROOF_DATA__?: DesignDoc;
    /**
     * Set only by the press-PDF job, which prints this page rather than
     * screenshotting it. Left undefined by the review-image and template
     * thumbnail jobs, which want the on-screen layout.
     */
    __PROOF_PRINT__?: boolean;
  }
}

const noop = () => {};

/**
 * Print layout: one artboard per physical page, at true size.
 *
 * Chromium's own printer emits live text and embedded fonts, so the press
 * PDF is vector rather than a raster of the screen — but only if the page
 * is laid out for paper. That means an @page the exact size of the
 * artboard, no page margins, no container padding, a forced break after
 * every artboard, and print-color-adjust so the artwork's backgrounds
 * survive. The drop shadow is screen furniture and must not print.
 */
const PRINT_CSS = `
@page { size: ${ARTBOARD_W_MM}mm ${ARTBOARD_H_MM}mm; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
[data-proof-container] { padding: 0 !important; gap: 0 !important; min-height: 0 !important; }
[data-proof-page] { break-after: page; break-inside: avoid; }
[data-proof-page]:last-child { break-after: auto; }
[data-proof-page] * { box-shadow: none !important; }
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
`;

/**
 * Hidden render target for the server-side proof job (see /api/proof).
 *
 * Renders the design with the exact same <PageCanvas> the live editor uses
 * — guides and interaction switched off — so Puppeteer is screenshotting
 * the real UI, not a second reimplementation of the layout. Signals
 * readiness via a data-proof-ready attribute once fonts, images and layout
 * have all settled.
 */
export default function ProofRenderClient() {
  const [doc, setDoc] = useState<DesignDoc | null>(null);
  const [print, setPrint] = useState(false);
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       One-time read of a global Puppeteer injects before hydration; there
       is no React-owned source of truth to derive this from. */
    if (window.__PROOF_DATA__) {
      setPrint(!!window.__PROOF_PRINT__);
      setDoc(window.__PROOF_DATA__);
      return;
    }
    const onData = () => {
      if (window.__PROOF_DATA__) {
        setPrint(!!window.__PROOF_PRINT__);
        setDoc(window.__PROOF_DATA__);
      }
    };
    window.addEventListener("proof-data-ready", onData);
    return () => window.removeEventListener("proof-data-ready", onData);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;

    const waitForImages = () => {
      const images = Array.from(document.querySelectorAll("img"));
      return Promise.all(
        images.map((img) =>
          img.complete
            ? Promise.resolve()
            : new Promise<void>((resolve) => {
                img.addEventListener("load", () => resolve(), { once: true });
                img.addEventListener("error", () => resolve(), { once: true });
              }),
        ),
      );
    };

    /** Resolves once two consecutive animation frames report the same layout size. */
    const waitForStableLayout = () =>
      new Promise<void>((resolve) => {
        let lastHeight = -1;
        let stableFrames = 0;
        const tick = () => {
          const height = containerRef.current?.scrollHeight ?? 0;
          if (height === lastHeight) {
            stableFrames += 1;
          } else {
            stableFrames = 0;
            lastHeight = height;
          }
          if (stableFrames >= 2) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });

    (async () => {
      await document.fonts.ready;
      await waitForImages();
      await waitForStableLayout();
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [doc]);

  if (!doc) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <div
      ref={containerRef}
      data-proof-container=""
      data-proof-ready={ready ? "true" : undefined}
      className="flex min-h-screen flex-col items-start gap-10 bg-white p-10"
    >
      {print && <style>{PRINT_CSS}</style>}
      {/* The dev-mode route indicator (nextjs-portal) mounts outside this
          container and is dev-only — hidden here so a local test proof
          doesn't pick it up; it never renders in a production build. */}
      <style>{"nextjs-portal { display: none !important; }"}</style>
      {doc.pages.map((page, index) => (
        <div key={page.id} data-proof-page={index}>
          <PageCanvas
            page={page}
            zoom={print ? PRINT_ZOOM : 1}
            showCut={false}
            showSafe={false}
            selectedId={null}
            editingId={null}
            onSelect={noop}
            onStartDrag={noop}
            onStartEdit={noop}
            onEditText={noop}
            onEndEdit={noop}
            onBackgroundClick={noop}
          />
        </div>
      ))}
    </div>
  );
}
