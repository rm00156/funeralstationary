/**
 * Where rendered background artwork lives and how it's addressed. Shared by
 * the fetch runner (which writes) and the template generator (which only
 * needs the URL): object storage when S3 is configured, else public/ so the
 * pipeline works in development without a bucket — the same split as
 * template thumbnails.
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isStorageConfigured, publicUrlFor, uploadObject } from "@/lib/storage";
import { backgroundAssetKey } from "@/lib/backgroundArtwork";
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

/** The licence record kept next to the images, regardless of where they're stored. */
export async function writeBackgroundCredits(
  entries: Array<{ id: string; name: string; licence: string; credit: string; sourceUrl: string }>,
): Promise<string> {
  const file = localPath("templates/backgrounds/credits.json");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(entries, null, 2) + "\n");
  return file;
}
