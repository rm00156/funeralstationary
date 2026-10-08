"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

import { TRUSTPILOT } from "@/lib/site";

/** Trustpilot's free "Micro Review Count" template: "See our N reviews on ★ Trustpilot". */
const MICRO_REVIEW_COUNT = "5419b6a8b0d04a076446a9ad";
const BOOTSTRAP_SRC = "https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js";

declare global {
  interface Window {
    Trustpilot?: { loadFromElement: (element: HTMLElement, forceReload?: boolean) => void };
  }
}

/**
 * Trustpilot's own badge, drawn and kept current by Trustpilot — the one
 * figure on the page we can't have typed. It needs Trustpilot's bootstrap
 * script: the badge's frame pings its parent page and, with no answer, shows
 * only the Trustpilot logo.
 *
 * The script sets no cookies and uses no storage. Its only cookie path is a
 * split test it joins when the element carries `data-group`, so never add
 * one — that would need consent (see /privacy and siteCookies.ts).
 */
export default function TrustpilotBadge() {
  const ref = useRef<HTMLDivElement>(null);

  // The script initialises the badges on the page when it first loads. On a
  // later client-side visit it is already loaded, so draw this one by hand.
  useEffect(() => {
    if (ref.current && window.Trustpilot) window.Trustpilot.loadFromElement(ref.current, true);
  }, []);

  return (
    <>
      <div
        ref={ref}
        // Free accounts get the badge centred whatever data-style-alignment says
        // (alignment is a custom style, a paid feature), so the frame is sized to
        // the ~243px text plus ~12px the badge keeps for itself, with headroom
        // for wider system fonts, and pulled left past the badge's own padding so
        // the text lines up with the stars above it.
        className="trustpilot-widget -ml-[18px] h-6 w-[272px] max-w-[calc(100%+18px)]"
        data-locale="en-GB"
        data-template-id={MICRO_REVIEW_COUNT}
        data-businessunit-id={TRUSTPILOT.businessUnitId}
        data-style-height="24px"
        data-style-width="100%"
        data-theme="light"
      >
        {/* Shown until the script replaces it, and for good if it's blocked. */}
        <a href={TRUSTPILOT.profileUrl} target="_blank" rel="noopener noreferrer" className="link">
          Based on {TRUSTPILOT.reviewCount} reviews on Trustpilot
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
      <Script src={BOOTSTRAP_SRC} strategy="afterInteractive" />
    </>
  );
}
