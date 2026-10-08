/**
 * Vendor the site's Google Fonts into src/fonts/ — the woff2 files plus one
 * fonts.css of @font-face rules and the --font-* variables the site and the
 * editor read (globals.css, FONT_OPTIONS in designEditor.ts).
 *
 * Why not next/font/google: it fetches every family's CSS from Google on
 * each build, and Google sometimes answers with extensionless
 * `fonts.gstatic.com/l/font?kit=…&skey=…` URLs, which fail the build in both
 * bundlers (vercel/next.js#99114). With ~50 families nearly every build hit
 * one. Why not next/font/local: it has no per-file unicode-range, so a
 * family's latin-ext/cyrillic/… files can't sit beside its latin one, and
 * an accented name would print in a fallback face.
 *
 * The CSS is requested exactly as next/font requested it (same user agent,
 * same css2 query), so the files are the ones the site already served and
 * a saved design prints with the same glyphs. Re-run after changing FONTS:
 *
 *   npx tsx scripts/vendor-fonts.ts
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/** [Google family, CSS variable, weights, also italic] — mirrors the old next/font calls in layout.tsx. */
const FONTS: [string, string, string[], boolean?][] = [
  // The site's two faces (HANDOFF.md "Type").
  ["Newsreader", "--font-newsreader", ["400", "500"], true],
  ["Work Sans", "--font-work-sans", ["300", "400", "500", "600"]],
  // The editor's "Source Serif" option — the old heading face (see CLAUDE.md).
  ["Source Serif 4", "--font-source-serif", ["400", "500", "600"]],
  ["Great Vibes", "--font-script", ["400"]],
  // The editor's font picker (FONT_OPTIONS): serif / display…
  ["Playfair Display", "--font-playfair", ["400", "600"]],
  ["Cormorant Garamond", "--font-cormorant", ["400", "600"]],
  ["Lora", "--font-lora", ["400", "600"]],
  ["EB Garamond", "--font-eb-garamond", ["400", "600"]],
  ["Cormorant", "--font-cormorant-alt", ["400", "600"]],
  ["Libre Baskerville", "--font-libre-baskerville", ["400", "600"]],
  ["Marcellus", "--font-marcellus", ["400"]],
  ["Prata", "--font-prata", ["400"]],
  ["Spectral", "--font-spectral", ["400", "600"]],
  ["Vollkorn", "--font-vollkorn", ["400", "600"]],
  ["Domine", "--font-domine", ["400", "600"]],
  ["PT Serif", "--font-pt-serif", ["400", "700"]],
  ["Merriweather", "--font-merriweather", ["400", "600"]],
  ["Cardo", "--font-cardo", ["400", "700"]],
  ["Alegreya", "--font-alegreya", ["400", "600"]],
  // …sans…
  ["Inter", "--font-inter", ["400", "600"]],
  ["Lato", "--font-lato", ["400", "700"]],
  ["Karla", "--font-karla", ["400", "600"]],
  ["Nunito Sans", "--font-nunito-sans", ["400", "600"]],
  ["Raleway", "--font-raleway", ["400", "600"]],
  ["Josefin Sans", "--font-josefin-sans", ["400", "600"]],
  ["Cabin", "--font-cabin", ["400", "600"]],
  ["Quicksand", "--font-quicksand", ["400", "600"]],
  ["Mulish", "--font-mulish", ["400", "600"]],
  // …and script.
  ["Dancing Script", "--font-dancing", ["400", "600"]],
  ["Alex Brush", "--font-alex-brush", ["400"]],
  ["Tangerine", "--font-tangerine", ["400", "700"]],
  ["Sacramento", "--font-sacramento", ["400"]],
  ["Parisienne", "--font-parisienne", ["400"]],
  ["Allura", "--font-allura", ["400"]],
  ["Petit Formal Script", "--font-petit-formal-script", ["400"]],
  ["Mrs Saint Delafield", "--font-mrs-saint-delafield", ["400"]],
  ["Pinyon Script", "--font-pinyon-script", ["400"]],
  ["Italianno", "--font-italianno", ["400"]],
  ["Meddon", "--font-meddon", ["400"]],
  ["Herr Von Muellerhoff", "--font-herr-von-muellerhoff", ["400"]],
  ["Mea Culpa", "--font-mea-culpa", ["400"]],
  ["WindSong", "--font-windsong", ["400", "500"]],
  ["Marck Script", "--font-marck-script", ["400"]],
  ["Yesteryear", "--font-yesteryear", ["400"]],
  ["League Script", "--font-league-script", ["400"]],
  ["Rouge Script", "--font-rouge-script", ["400"]],
  ["Ballet", "--font-ballet", ["400"]],
  ["La Belle Aurore", "--font-la-belle-aurore", ["400"]],
  ["Courgette", "--font-courgette", ["400"]],
  ["Satisfy", "--font-satisfy", ["400"]],
  ["Kristi", "--font-kristi", ["400"]],
];

/** next/font's own user agent — Google picks the file format from it. */
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/104.0.0.0 Safari/537.36";

const OUT_DIR = path.join(process.cwd(), "src/fonts");

/** The css2 query next/font builds: `Family:wght@400;600`, or `Family:ital,wght@0,400;…;1,400;…`. */
function cssUrl(family: string, weights: string[], italic?: boolean): string {
  const axes = italic
    ? `ital,wght@${[...weights.map((w) => `0,${w}`), ...weights.map((w) => `1,${w}`)].join(";")}`
    : `wght@${weights.join(";")}`;
  return `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:${axes}&display=swap`;
}

async function fetchOk(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (response.ok) return response;
    if (attempt === 3) throw new Error(`${url} answered ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
  }
}

/** A stable local name: the family, then a short hash of the source URL (works for /s/ and /l/ URLs alike). */
function fileName(family: string, url: string): string {
  const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `${slug}-${createHash("sha1").update(url).digest("hex").slice(0, 10)}.woff2`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const entry of await readdir(OUT_DIR)) {
    if (entry.endsWith(".woff2")) await rm(path.join(OUT_DIR, entry));
  }

  const faces: string[] = [];
  const variables: string[] = [];
  let files = 0;
  let bytes = 0;
  for (const [family, variable, weights, italic] of FONTS) {
    const css = await (await fetchOk(cssUrl(family, weights, italic))).text();
    const downloaded = new Map<string, string>();
    const rewritten = await replaceAsync(css, /url\(([^)]+)\)/g, async (_, url: string) => {
      let local = downloaded.get(url);
      if (!local) {
        local = fileName(family, url);
        const data = Buffer.from(await (await fetchOk(url)).arrayBuffer());
        await writeFile(path.join(OUT_DIR, local), data);
        downloaded.set(url, local);
        files += 1;
        bytes += data.length;
      }
      return `url(./${local})`;
    });
    faces.push(`/* ${family} */\n${rewritten.trim()}`);
    variables.push(`  ${variable}: "${family}";`);
    console.log(`${family}: ${downloaded.size} file(s)`);
  }

  const header = `/*
 * Generated by scripts/vendor-fonts.ts — don't edit by hand; change FONTS
 * there and re-run it. Self-hosted Google Fonts (SIL Open Font License /
 * Apache 2.0), with Google's own unicode-range subsets.
 */`;
  await writeFile(
    path.join(OUT_DIR, "fonts.css"),
    `${header}\n\n${faces.join("\n\n")}\n\n:root {\n${variables.join("\n")}\n}\n`,
  );
  console.log(`\n${FONTS.length} families, ${files} files, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
}

async function replaceAsync(
  input: string,
  pattern: RegExp,
  replacer: (match: string, group: string) => Promise<string>,
): Promise<string> {
  const parts: string[] = [];
  let last = 0;
  for (const match of input.matchAll(pattern)) {
    parts.push(input.slice(last, match.index), await replacer(match[0], match[1]));
    last = match.index! + match[0].length;
  }
  parts.push(input.slice(last));
  return parts.join("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
