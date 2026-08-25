# The Funeral Stationery

A marketing/product frontend for a funeral stationery business, built on Next.js 16 (App Router), React 19, and Tailwind CSS v4. The design system ("Serene Legacy") originates from a Stitch export in `stitch_funeral_stationery_redesign/` and is wired into `globals.css` as CSS custom properties consumed via Tailwind's `@theme inline`. It also includes a small server-side layer: a stationery design editor (`/design`) that generates print-ready PDF proofs via a headless-Chromium Route Handler — see **Proof Generation** below.

## Core Commands

- **Development:** `npm run dev`
- **Build:** `npm run build`
- **Start (prod):** `npm run start`
- **Linting:** `npm run lint`

There is no test runner, database, or auth layer configured yet — do not assume `npm run typecheck` or `npm test` exist as scripts. `npm run dev`/`npm run build` also drive the proof-generation Route Handler below; it needs no extra setup locally (Puppeteer downloads its own Chromium on `npm install`).

## Architecture & Tech Stack Rules

- **Framework:** Next.js 16 App Router (`src/app/`) with React 19. Server Components by default; add `"use client"` only where interactivity requires it.
- **Path alias:** `@/*` maps to `src/*` (see [tsconfig.json](tsconfig.json)).
- **Styling:** Tailwind CSS v4 via the PostCSS plugin — no `tailwind.config.*` file; theme tokens (colors, fonts, spacing) are defined as CSS custom properties in [src/app/globals.css](src/app/globals.css) inside `:root` and re-exposed through `@theme inline`. When adding a new design token, add it in both places, matching the naming in [stitch_funeral_stationery_redesign/DESIGN.md](stitch_funeral_stationery_redesign/DESIGN.md).
- **Design system:** Treat `DESIGN.md` as the source of truth for color, type, spacing, radius, and elevation decisions ("Compassionate Professionalism" — soft, muted, generous whitespace, rounded corners, ambient shadows, never harsh black shadows or aggressive color shifts). Match its intent before improvising new visual patterns.
- **Fonts:** `Source Serif 4` (display/headings, `font-display`) paired with `Work Sans` (body/UI, `font-body`), loaded via `next/font/google` in [src/app/layout.tsx](src/app/layout.tsx).
- **Icons:** `lucide-react`.
- **Components:** Presentational components live in `src/components/` as top-level, PascalCase files (e.g. `Header.tsx`, `Hero.tsx`). No nested component directories yet — keep new components flat unless a section grows enough to warrant a subfolder.

## Proof Generation

The `/design` editor (`src/components/DesignEditor.tsx`) builds a `DesignDoc` (see `src/lib/designEditor.ts`) — pages of percentage-positioned text/photo/shape/clipart/frame elements. To turn that into a print-ready PDF, `POST /api/proof` (`src/app/api/proof/route.ts`):

1. Launches headless Chromium and navigates to the hidden, `noindex` route `/proof-render` (`src/app/proof-render/page.tsx` → `ProofRenderClient.tsx`), which renders the **same** `PageCanvas` component the live editor uses (imported from `DesignEditor.tsx`), fed via `window.__PROOF_DATA__`.
2. Waits for `document.fonts.ready`, all `<img>` elements to load, and two stable animation frames, signalled back via a `data-proof-ready` attribute — never screenshot before this fires.
3. Screenshots each `[data-proof-page]` element at `deviceScaleFactor: 4` (~305dpi against the canvas's 3px/mm base) and embeds each PNG into a `pdf-lib` PDF page sized to the true bleed dimensions (`ARTBOARD_W_MM`/`ARTBOARD_H_MM`), with crop marks drawn at the trim line.

This exists specifically so the PDF is guaranteed pixel-identical to what the customer saw on screen — never reimplement the layout/font-rendering logic as a second renderer (e.g. drawing shapes/text directly with `pdf-lib`); always route new export formats through screenshotting the real component.

**Local vs production Chromium:** `puppeteer` (devDependency, downloads a real Chromium locally) is used when `process.env.VERCEL` is unset; `puppeteer-core` + `@sparticuz/chromium` (Linux-only) is used on Vercel. `next.config.ts`'s `outputFileTracingExcludes` keeps the dev-only package out of the deployed function. **Requires Vercel Pro or higher** — the route's `maxDuration` exceeds the Hobby plan's 10s ceiling.

## Claude Code Execution Directives

1. **Targeted Edits Only:** Do NOT rewrite entire files for localized changes. Use surgical diffs.
2. **Verification Loop:** Run `npm run lint` after changes. There is no typecheck script or test suite to run — do not invent one or assume it exists.
3. **No Unrequested Packages:** Never run `npm install` for new libraries unless explicitly requested. This project has no database or auth layer — don't introduce them speculatively. (It does have one server-side feature, proof generation — see **Proof Generation** above — that's an intentional, already-approved exception, not precedent for adding other backend infrastructure unasked.)
4. **Design Fidelity:** When building new UI, check `DESIGN.md` and the existing `globals.css` tokens first. Don't hardcode raw hex colors or arbitrary spacing values in components when an equivalent token already exists.
5. **No Ad-Hoc Manual Verification Rigs:** For small, low-risk UI/layout changes, do NOT stand up a throwaway verification rig (spinning up a dev server, screenshotting) just to confirm something answerable by reading the code/diff. Answer directly, or ask the user if they'd rather share a screenshot. Reserve real browser verification for changes where correctness can't be judged by reading the code, and even then, ask first before standing up that kind of rig.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
