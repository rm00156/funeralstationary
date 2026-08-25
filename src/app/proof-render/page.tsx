import type { Metadata } from "next";

import ProofRenderClient from "@/components/ProofRenderClient";

// Internal-only render target for the server-side proof job — never linked
// from the site and not meant to be crawled or visited directly.
export const metadata: Metadata = {
  title: "Proof render",
  robots: { index: false, follow: false },
};

export default function ProofRenderPage() {
  return <ProofRenderClient />;
}
