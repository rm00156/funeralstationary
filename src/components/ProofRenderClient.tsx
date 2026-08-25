"use client";

import { useEffect, useRef, useState } from "react";

import { PageCanvas } from "@/components/DesignEditor";
import type { DesignDoc } from "@/lib/designEditor";

declare global {
  interface Window {
    /** Set by the Puppeteer job via page.evaluate() before it fires "proof-data-ready". */
    __PROOF_DATA__?: DesignDoc;
  }
}

const noop = () => {};

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
  const [ready, setReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       One-time read of a global Puppeteer injects before hydration; there
       is no React-owned source of truth to derive this from. */
    if (window.__PROOF_DATA__) {
      setDoc(window.__PROOF_DATA__);
      return;
    }
    const onData = () => {
      if (window.__PROOF_DATA__) setDoc(window.__PROOF_DATA__);
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
      data-proof-ready={ready ? "true" : undefined}
      className="flex min-h-screen flex-col items-start gap-10 bg-white p-10"
    >
      {/* The dev-mode route indicator (nextjs-portal) mounts outside this
          container and is dev-only — hidden here so a local test proof
          doesn't pick it up; it never renders in a production build. */}
      <style>{"nextjs-portal { display: none !important; }"}</style>
      {doc.pages.map((page, index) => (
        <div key={page.id} data-proof-page={index}>
          <PageCanvas
            page={page}
            zoom={1}
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
