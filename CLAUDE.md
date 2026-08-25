# The Funeral Stationery

A marketing/product frontend for a funeral stationery business, built on Next.js 16 (App Router), React 19, and Tailwind CSS v4. The design system ("Serene Legacy") originates from a Stitch export in `stitch_funeral_stationery_redesign/` and is wired into `globals.css` as CSS custom properties consumed via Tailwind's `@theme inline`. It also includes a small server-side layer: a stationery design editor (`/design`) that generates print-ready PDF proofs via a headless-Chromium Route Handler — see **Proof Generation** below.

## Core Commands

- **Development:** `npm run dev`
- **Build:** `npm run build`
- **Start (prod):** `npm run start`
- **Linting:** `npm run lint`
- **Tests:** `npm test` (Vitest)
- **Database:** `npm run db:generate` / `db:migrate` / `db:push` / `db:seed` / `db:studio` (Drizzle Kit) — see **Data Layer** below.

There is still no `npm run typecheck` script — do not assume one exists. `npm run dev`/`npm run build` also drive the proof-generation Route Handler below; it needs no extra setup locally (Puppeteer downloads its own Chromium on `npm install`).

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

## Data Layer

Drizzle ORM + MySQL 8 (`mysql2` driver). Schema lives in `src/db/schema/*.ts`, the client in `src/db/index.ts` (`db`, an HMR-safe pooled singleton — throws if `DATABASE_URL` is unset). No app route imports `src/db` yet; this is schema/migrations only, laid down ahead of wiring the editor and a cart/checkout flow to it.

- **Slug PKs for catalogue rows, UUID PKs for user data.** `products`, `template_categories`, `templates` and the pricing tables keep the human-readable ids already used in URLs and in `DesignDoc.templateId` (`src/lib/templates.ts`) as `varchar(64)` primary keys. `users`, `designs`, `orders`, etc. use `char(36)` UUIDs (`crypto.randomUUID()`).
- **Money is integer pence**, never floats (`vat_pence`, `unit_price_pence`, ...). Multiplier columns are `decimal(6,4)`.
- **Live rows reference the catalogue; order rows snapshot it.** `designs` FKs into the pricing tables (`size_options`/`colour_options`/`paper_options`/`quantity_options`/`page_count_options`/`delivery_options`), each scoped by `product_id` with a composite FK — see `designs.ts` for why size/colour/paper are three tables, not one polymorphic table (MySQL FKs must target an exact unique key). `order_items`/`orders` instead store the resolved spec as plain snapshot columns with **no FK**, plus a `quote_snapshot`/`doc_snapshot` JSON blob of exactly what the customer saw — so a later catalogue or price change can never rewrite order history.
- **No cart table** — a cart is an `orders` row with `status = 'draft'`.
- `src/db/seedData.ts` holds pure seed-row builders (no DB import, so they're unit-testable — see `seedData.test.ts`) derived directly from the `src/lib/templates.ts` / `src/lib/orderOfServicePricing.ts` constants; `src/db/seed.ts` is the thin runner (`npm run db:seed`) that idempotently upserts them.
- `templates.layout` is nullable — null means "fall back to `makeStarterDoc()`" (today's behaviour for all 16 seeded templates); a per-template `DesignPage[]` can be filled in later with no code change.
- `designs.doc` is the `DesignDoc` JSON blob. `ImageElement.src` holds an object-storage **URL**, not base64 — see **Photo Uploads** below.

## Design Persistence

`/design` saves server-side; there is no `localStorage` fallback any more.

- **Ownership without auth.** `src/lib/session.ts` issues an httpOnly `tfs_guest` cookie and returns an `Owner`. Every query in `src/lib/designs.server.ts` is scoped by it, so one visitor can never read or mutate another's design (a cross-owner fetch 404s rather than 403s — don't leak existence). When accounts land, registration claims rows by setting `user_id` and clearing `guest_token`; no data migration needed.
- **Routes:** `GET`/`POST /api/designs`, `GET`/`PATCH`/`DELETE /api/designs/[id]`. `DELETE` is a **soft** delete (`deleted_at`), so an `order_item` pointing at the design still reads.
- **Lazy creation.** Opening the editor does *not* insert a row. The first save (autosave or the Save button) POSTs, then swaps the new id into the URL with `history.replaceState`. Don't "fix" this into an eager insert — it would litter the table on every visit.
- **Validation lives in `validateDesignPayload`.** It enforces the page-count invariant (`doc.pages.length` must equal the chosen `PAGE_OPTIONS` entry's `pages`, because `setPageCount` drives both). MySQL `CHECK` can't reach another table, so this function is the only enforcement point — keep new spec fields validated there.
- Autosave is debounced 1.5s in `DesignEditor.tsx`; the Save button calls the same `persist()`.

## Photo Uploads

`POST /api/assets` returns a **presigned PUT**; the browser uploads bytes straight to object storage. Bytes must never pass through a Route Handler — Vercel caps serverless request bodies at 4.5MB and print-resolution photos exceed it. `src/lib/storage.ts` is written against the plain S3 API so AWS S3, Cloudflare R2 and MinIO all work (set `S3_ENDPOINT` for the latter two); the bucket needs a CORS rule permitting `PUT` from the site origin. Uploads are capped at `MAX_UPLOAD_BYTES` and restricted to `ALLOWED_IMAGE_TYPES`. With no `S3_*` env vars set the route returns 503 and the rest of the editor still works.

## Claude Code Execution Directives

1. **Targeted Edits Only:** Do NOT rewrite entire files for localized changes. Use surgical diffs.
2. **Verification Loop:** Run `npm run lint` and `npm test` after changes. There is still no typecheck script — do not invent one or assume it exists (run `npx tsc --noEmit` directly if you need one).
3. **No Unrequested Packages:** Never run `npm install` for new libraries unless explicitly requested. (Proof generation and the Drizzle/MySQL data layer — see **Proof Generation** and **Data Layer** above — are intentional, already-approved exceptions, not precedent for adding other backend infrastructure unasked. There is still no auth provider — don't add one speculatively.)
4. **Design Fidelity:** When building new UI, check `DESIGN.md` and the existing `globals.css` tokens first. Don't hardcode raw hex colors or arbitrary spacing values in components when an equivalent token already exists.
5. **No Ad-Hoc Manual Verification Rigs:** For small, low-risk UI/layout changes, do NOT stand up a throwaway verification rig (spinning up a dev server, screenshotting) just to confirm something answerable by reading the code/diff. Answer directly, or ask the user if they'd rather share a screenshot. Reserve real browser verification for changes where correctness can't be judged by reading the code, and even then, ask first before standing up that kind of rig.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
