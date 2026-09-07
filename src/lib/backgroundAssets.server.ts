/**
 * Where rendered background artwork lives and how it's addressed. Shared by
 * the fetch runner (which writes) and the template generator (which only
 * needs the URL): object storage when S3 is configured, else public/ so the
 * pipeline works in development without a bucket — the same split as
 * template thumbnails.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isStorageConfigured, publicUrlFor, uploadObject } from "@/lib/storage";
import {
  backgroundAssetKey,
  mergeCredits,
  sprayAssetKey,
  type BackgroundCredit,
} from "@/lib/backgroundArtwork";
import {
  placeholderPortraitKey,
  type PlaceholderPortraitId,
} from "@/lib/placeholderPortraits";
import type { PaletteId } from "@/lib/templateGenerator";

function localPath(key: string): string {
  return path.join(process.cwd(), "public", key);
}

/** The URL a page element should use for a rendered background. */
export function backgroundAssetUrl(id: string, palette: PaletteId): string {
  const key = backgroundAssetKey(id, palette);
  return isStorageConfigured() ? publicUrlFor(key) : `/${key}`;
}

/** True when a rendered background already exists (local mode only — S3 is always rewritten). */
export async function backgroundAssetExists(id: string, palette: PaletteId): Promise<boolean> {
  if (isStorageConfigured()) return false;
  try {
    await access(localPath(backgroundAssetKey(id, palette)));
    return true;
  } catch {
    return false;
  }
}

/** The URL of a stand-in portrait, used in template previews only. */
export function placeholderPortraitUrl(id: PlaceholderPortraitId): string {
  const key = placeholderPortraitKey(id);
  return isStorageConfigured() ? publicUrlFor(key) : `/${key}`;
}

/** The URL a page element should use for a rendered cutout spray. */
export function sprayAssetUrl(id: string): string {
  const key = sprayAssetKey(id);
  return isStorageConfigured() ? publicUrlFor(key) : `/${key}`;
}

export async function saveSprayAsset(id: string, png: Buffer): Promise<string> {
  const key = sprayAssetKey(id);
  if (isStorageConfigured()) return uploadObject(key, png, "image/png");
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, png);
  return `/${key}`;
}

export async function sprayAssetExists(id: string): Promise<boolean> {
  if (isStorageConfigured()) return false;
  try {
    await access(localPath(sprayAssetKey(id)));
    return true;
  } catch {
    return false;
  }
}

export async function saveBackgroundAsset(
  id: string,
  palette: PaletteId,
  jpeg: Buffer,
): Promise<string> {
  const key = backgroundAssetKey(id, palette);
  if (isStorageConfigured()) return uploadObject(key, jpeg, "image/jpeg");
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, jpeg);
  return `/${key}`;
}

/**
 * The licence and attribution record. Written to docs/ — deliberately NOT
 * beside the images, since public/templates/backgrounds/ is gitignored and in
 * S3 mode the images don't land locally at all, which would leave the
 * attribution record untracked.
 *
 * Merged against what's already on disk (see mergeCredits) so a partial run
 * records the whole manifest, not just the backgrounds it fetched.
 */
export async function writeBackgroundCredits(
  resolved: readonly BackgroundCredit[],
): Promise<string> {
  const file = path.join(process.cwd(), "docs", "template-artwork-credits.json");
  let existing: BackgroundCredit[] = [];
  try {
    existing = JSON.parse(await readFile(file, "utf8")) as BackgroundCredit[];
    if (!Array.isArray(existing)) existing = [];
  } catch {
    // no record yet, or it's unreadable — rebuild it from the manifest
  }
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(mergeCredits(existing, resolved), null, 2) + "\n");
  return file;
}
