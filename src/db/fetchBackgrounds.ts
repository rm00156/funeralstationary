/**
 * Background artwork fetcher (`npm run backgrounds:fetch`).
 *
 * For every entry in BACKGROUND_SPECS (src/lib/backgroundArtwork.ts):
 * resolve its source to an image URL (Met Open Access, Wikimedia Commons,
 * Pexels, or a plain URL), download it once into node_modules/.cache, render
 * one cropped/tinted/faded variant per palette through headless Chromium
 * (src/lib/backgroundRender.server.ts), and save each as
 * templates/backgrounds/<id>-<palette>.jpg — in object storage when S3 is
 * configured, else under public/. A credits.json licence record is written
 * alongside either way.
 *
 * No database involved. The template generator (`npm run templates:generate`)
 * references the rendered files by their deterministic key.
 *
 * Usage:
 *   npm run backgrounds:fetch -- [--only=id,id] [--palette=plum,forest] [--force]
 *
 * Env: PEXELS_API_KEY for `pexels` sources; S3_* to write to object storage.
 */

import "dotenv/config";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BACKGROUND_SPECS,
  DEFAULT_INSET,
  DEFAULT_SPRAY_CROP_BOTTOM,
  DEFAULT_SPRAY_MIN_ENCLOSED,
  DEFAULT_TINT,
  DEFAULT_WASH,
  type BackgroundSourceRef,
  type BackgroundSpec,
} from "@/lib/backgroundArtwork";
import {
  backgroundAssetExists,
  saveBackgroundAsset,
  saveSprayAsset,
  sprayAssetExists,
  writeBackgroundCredits,
} from "@/lib/backgroundAssets.server";
import { createBackgroundRenderer, type BackgroundRenderer } from "@/lib/backgroundRender.server";
import { isStorageConfigured } from "@/lib/storage";
import { TEMPLATE_PALETTES, type PaletteId } from "@/lib/templateGenerator";

const USER_AGENT = "TheFuneralStationery/1.0 (background artwork fetch; dev tooling)";
const CACHE_DIR = path.join(process.cwd(), "node_modules", ".cache", "tfs-backgrounds");

function flag(name: string): string | undefined {
  const match = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return match?.slice(name.length + 3);
}

const has = (name: string) => process.argv.includes(`--${name}`);
const list = (value: string | undefined) =>
  value?.split(",").map((entry) => entry.trim()).filter(Boolean);

const only = list(flag("only"));
const paletteFilter = list(flag("palette")) as PaletteId[] | undefined;
const force = has("force");

interface ResolvedSource {
  url: string;
  headers?: Record<string, string>;
  /** Human-readable page for the credits record. */
  sourceUrl: string;
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return (await response.json()) as T;
}

async function resolveSource(ref: BackgroundSourceRef): Promise<ResolvedSource> {
  switch (ref.kind) {
    case "met": {
      const object = await fetchJson<{
        isPublicDomain: boolean;
        primaryImage: string;
        objectURL: string;
        title: string;
      }>(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${ref.objectId}`);
      if (!object.isPublicDomain) {
        throw new Error(`Met object ${ref.objectId} (${object.title}) is not public domain`);
      }
      if (!object.primaryImage) throw new Error(`Met object ${ref.objectId} has no image`);
      return { url: encodeURI(object.primaryImage), sourceUrl: object.objectURL };
    }
    case "commons": {
      const params = new URLSearchParams({
        action: "query",
        titles: ref.file,
        prop: "imageinfo",
        iiprop: "url|size|extmetadata",
        iiurlwidth: "2400",
        format: "json",
      });
      const data = await fetchJson<{
        query: {
          pages: Record<
            string,
            {
              missing?: string;
              imageinfo?: Array<{
                url: string;
                thumburl?: string;
                width: number;
                descriptionurl: string;
                extmetadata?: { LicenseShortName?: { value: string } };
              }>;
            }
          >;
        };
      }>(`https://commons.wikimedia.org/w/api.php?${params}`);
      const page = Object.values(data.query.pages)[0];
      const info = page?.imageinfo?.[0];
      if (!info) throw new Error(`Commons file not found: ${ref.file}`);
      const licence = info.extmetadata?.LicenseShortName?.value ?? "unknown";
      if (!/public domain|cc0/i.test(licence)) {
        throw new Error(`Commons file ${ref.file} is "${licence}", not public domain/CC0`);
      }
      // Commons serves a down-scaled rendition on request; the original can
      // be 30MB+ and 2400px is already above print resolution for this page.
      return {
        url: (info.width > 2400 && info.thumburl) || info.url,
        headers: { "User-Agent": USER_AGENT },
        sourceUrl: info.descriptionurl,
      };
    }
    case "pexels": {
      const key = process.env.PEXELS_API_KEY;
      if (!key) throw new Error("PEXELS_API_KEY is not set");
      const photo = await fetchJson<{ src: { original: string }; url: string }>(
        `https://api.pexels.com/v1/photos/${ref.photoId}`,
        { Authorization: key },
      );
      return { url: photo.src.original, headers: { Authorization: key }, sourceUrl: photo.url };
    }
    case "url":
      return { url: ref.url, sourceUrl: ref.url };
  }
}

/** Download once; re-renders (new palettes, tweaked fades) reuse the cached bytes. */
async function download(
  spec: BackgroundSpec,
  source: ResolvedSource,
): Promise<{ bytes: Buffer; contentType: string }> {
  await mkdir(CACHE_DIR, { recursive: true });
  const cacheFile = path.join(CACHE_DIR, `${spec.id}.bin`);
  const metaFile = path.join(CACHE_DIR, `${spec.id}.json`);
  try {
    const meta = JSON.parse(await readFile(metaFile, "utf8")) as { url: string; contentType: string };
    if (meta.url === source.url) {
      return { bytes: await readFile(cacheFile), contentType: meta.contentType };
    }
  } catch {
    // no cache yet
  }
  const response = await fetch(source.url, {
    headers: { "User-Agent": USER_AGENT, ...source.headers },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} downloading ${source.url}`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Expected an image from ${source.url}, got ${contentType}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(cacheFile, bytes);
  await writeFile(metaFile, JSON.stringify({ url: source.url, contentType }));
  return { bytes, contentType };
}

async function process_(spec: BackgroundSpec, renderer: BackgroundRenderer) {
  const palettes = spec.palettes.filter((p) => !paletteFilter || paletteFilter.includes(p));
  const pending: PaletteId[] = [];
  for (const palette of palettes) {
    if (force || !(await backgroundAssetExists(spec.id, palette))) pending.push(palette);
  }
  const needsSpray = !!spec.spray && (force || !(await sprayAssetExists(spec.id)));

  const source = await resolveSource(spec.source);
  if (pending.length === 0 && !needsSpray) {
    console.log(`  - ${spec.id} (all ${palettes.length} variants exist — pass --force to re-render)`);
    return { spec, sourceUrl: source.sourceUrl, rendered: 0 };
  }

  const image = await download(spec, source);

  // Cutout spray, if this plate supports one. Not per palette — see
  // sprayAssetKey. Best-effort: a failed cut leaves the backgrounds usable.
  if (spec.spray && (force || !(await sprayAssetExists(spec.id)))) {
    try {
      const png = await renderer.renderSpray(image, {
        tolerance: spec.spray.tolerance,
        inset: spec.inset ?? DEFAULT_INSET,
        cropBottom: spec.spray.cropBottom ?? DEFAULT_SPRAY_CROP_BOTTOM,
        minEnclosedRegion: spec.spray.minEnclosedRegion ?? DEFAULT_SPRAY_MIN_ENCLOSED,
      });
      if (png) {
        const url = await saveSprayAsset(spec.id, png);
        console.log(`  ✓ ${spec.id} spray → ${url} (${Math.round(png.length / 1024)} KB)`);
      } else {
        console.warn(`  ! ${spec.id} spray: nothing survived the cut`);
      }
    } catch (error) {
      console.warn(`  ! ${spec.id} spray failed: ${(error as Error).message}`);
    }
  }

  for (const palette of pending) {
    const colours = TEMPLATE_PALETTES[palette];
    const jpeg = await renderer.render(image, {
      paper: colours.paper,
      accent: colours.accent,
      focus: spec.focus ?? { x: 0.5, y: 0.5 },
      inset: spec.inset ?? DEFAULT_INSET,
      placement: spec.placement ?? { x: 0, y: 0, w: 100, h: 100 },
      feather: spec.feather ?? 0,
      fade: spec.fade ?? null,
      wash: spec.wash ?? DEFAULT_WASH,
      tint: spec.tint ?? DEFAULT_TINT,
    });
    const url = await saveBackgroundAsset(spec.id, palette, jpeg);
    console.log(`  ✓ ${spec.id}/${palette} → ${url} (${Math.round(jpeg.length / 1024)} KB)`);
  }
  return { spec, sourceUrl: source.sourceUrl, rendered: pending.length };
}

async function main() {
  const specs = only
    ? BACKGROUND_SPECS.filter((spec) => only.includes(spec.id))
    : BACKGROUND_SPECS;
  if (specs.length === 0) {
    console.error(only ? `No backgrounds matched --only=${only.join(",")}` : "No backgrounds to fetch");
    process.exitCode = 1;
    return;
  }

  console.log(
    `Fetching ${specs.length} background(s) → ` +
      (isStorageConfigured() ? "object storage" : "public/templates/backgrounds/"),
  );

  const renderer = await createBackgroundRenderer();
  const credits = [];
  let rendered = 0;
  let failed = 0;
  try {
    for (const spec of specs) {
      try {
        const result = await process_(spec, renderer);
        rendered += result.rendered;
        credits.push({
          id: spec.id,
          name: spec.name,
          licence: spec.licence,
          credit: spec.credit,
          sourceUrl: result.sourceUrl,
        });
      } catch (error) {
        failed += 1;
        console.warn(`  ! ${spec.id} failed: ${(error as Error).message}`);
      }
    }
  } finally {
    await renderer.close();
  }

  const creditsFile = await writeBackgroundCredits(credits);
  console.log(
    `\nDone: ${rendered} variant(s) rendered, ${failed} background(s) failed. ` +
      `Credits written to ${path.relative(process.cwd(), creditsFile)}.`,
  );
  if (failed > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
