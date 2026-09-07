/**
 * Server seam for the pre-order design check.
 *
 * The pure rules live in designReadiness.ts; this resolves the one thing they
 * need from the database — the template wording a design started life with —
 * and runs them. The editor runs the same check client-side for a live nudge,
 * but this is where it is *enforced*: the client sends slugs and a
 * confirmation flag, never a verdict.
 */
import type { DesignDoc, DesignPage } from "@/lib/designEditor";
import { makeStarterDoc } from "@/lib/designEditor";
import { checkDesignReadiness, type DesignReadiness } from "@/lib/designReadiness";
import { getTemplateBySlug } from "@/lib/catalogue.server";

/**
 * The pages a design was instantiated from: the template's authored layout,
 * or its generated starter document when it has none — exactly what /design
 * seeds a new document with.
 *
 * Returns null when the template can no longer be loaded (archived since the
 * design was made, say). The unchanged-text warnings are then skipped, which
 * is the right way round: warning is a nicety, and the blocking empty-photo
 * check does not depend on this at all.
 */
async function templateDefaultPages(
  templateId: string,
  pageCount: number,
): Promise<DesignPage[] | null> {
  const template = await getTemplateBySlug(templateId);
  if (!template) return null;
  if (template.layout) return template.layout;
  return makeStarterDoc(template, pageCount).pages;
}

/** Run the pre-order check against the template the design came from. */
export async function checkDocReadiness(
  templateId: string,
  doc: DesignDoc,
): Promise<DesignReadiness> {
  const pages = await templateDefaultPages(templateId, doc.pages.length);
  return checkDesignReadiness(doc, pages);
}
