import { NextResponse, type NextRequest } from "next/server";

import type { ProofRequest } from "@/lib/designEditor";
import { MAX_PROOF_PAGES, renderProofPdf } from "@/lib/proofPdf.server";

export const runtime = "nodejs";
// Vercel Pro (or higher) is required in production — a single-digit page
// count comfortably fits inside 60s, but this needs raising for large
// booklets. Hobby's 10s ceiling is not enough for a headless-Chromium job.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: ProofRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pages = body?.doc?.pages;
  if (!Array.isArray(pages) || pages.length === 0) {
    return NextResponse.json({ error: "doc.pages is required" }, { status: 400 });
  }
  if (pages.length > MAX_PROOF_PAGES) {
    return NextResponse.json(
      { error: `A proof can have at most ${MAX_PROOF_PAGES} pages` },
      { status: 400 },
    );
  }

  const pdf = await renderProofPdf(new URL(request.url).origin, body.doc);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="proof.pdf"',
    },
  });
}
