/**
 * Preview thumbnail backfill (`npm run templates:thumbnails`).
 *
 * Re-renders `templates.preview_image_url` from a template's *live* layout for
 * templates already in the database, whatever created them — the seeded
 * catalogue, the bulk generator, or an admin authoring by hand. Use it when
 * something that affects every preview changes, such as the stand-in portrait
 * substituted into empty photo windows (see placeholderPortraits).
 *
 * This only touches the preview image. Layouts, draft layouts, status and
 * every other field are left exactly as they are, so it is safe to run against
 * published templates customers are already browsing.
 *
 * Needs a running server, the same as the generator's thumbnails: start
 * `npm run dev` first, or pass --origin.
 *
 * Usage:
 *   npm run templates:thumbnails -- [--status=published|draft|archived]
 *                                   [--only=slug,slug] [--origin=http://localhost:3000]
 */

import "dotenv/config";
import { adminGetTemplate, adminListTemplates, adminUpdateTemplate } from "@/lib/adminCatalogue.server";
import { isStorageConfigured } from "@/lib/storage";
import { renderTemplateThumbnail, saveTemplateThumbnail } from "@/lib/templateThumbnail.server";

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

const origin = flag("origin") ?? "http://localhost:3000";
const status = flag("status");
const only = flag("only")?.split(",").map((entry) => entry.trim()).filter(Boolean);

async function main() {
  let list = await adminListTemplates();
  if (status) list = list.filter((entry) => entry.status === status);
  if (only) list = list.filter((entry) => only.includes(entry.slug));

  if (list.length === 0) {
    console.error("No templates matched");
    process.exitCode = 1;
    return;
  }

  console.log(
    `Re-rendering ${list.length} preview(s) via ${origin}` +
      (isStorageConfigured() ? " -> object storage" : " -> public/templates/<slug>/cover.png"),
  );

  let done = 0;
  let failed = 0;
  for (const entry of list) {
    try {
      const template = await adminGetTemplate(entry.slug);
      if (!template) throw new Error("disappeared between list and read");
      // A null layout means customers get makeStarterDoc's generic pages,
      // which need a full Template to build. Nothing in the catalogue is in
      // that state, so rather than fabricate one, say so and move on.
      if (!template.layout?.[0]) {
        console.log(`  - ${entry.slug} (no authored layout — nothing to screenshot)`);
        continue;
      }
      const png = await renderTemplateThumbnail(origin, template.layout[0], entry.slug);
      const url = await saveTemplateThumbnail(entry.slug, png);
      await adminUpdateTemplate(entry.slug, { previewImageUrl: url });
      done += 1;
      console.log(`  ✓ ${entry.slug}`);
    } catch (error) {
      failed += 1;
      console.warn(`  ! ${entry.slug}: ${(error as Error).message}`);
    }
  }

  console.log(`\nDone: ${done} refreshed, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
