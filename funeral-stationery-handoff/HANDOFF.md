# The Funeral Stationery — website redesign handoff

Design handoff for rebuilding thefuneralstationery.co.uk. Six page designs, a small design system, and the open questions the business owner still needs to answer.

**Live site context:** the current site appears to be WordPress + WooCommerce (URLs like `/product-category/thank-you-card/`). Confirm the stack before building; this spec is stack-agnostic.

## What's in this folder

| Path | What it is |
|---|---|
| `HANDOFF.md` | This spec. Treat it as the source of truth. |
| `source/*.dc.html` | The design source for each page (see "Reading the source files" below). Copy exact values from here. |
| `assets/logo.png` | Logo with a transparent background, 518×118. Cropped from a screenshot, so **ask the owner for the original vector logo** before launch. |

## Sitemap

| Page | Source file | Purpose |
|---|---|---|
| Home | `Main.dc.html` | Lead with Order of Service booklets, show the other products, build trust, push to phone help |
| Shop | `Shop.dc.html` | All products, filterable by occasion |
| Order of Service booklets (category) | `Booklets.dc.html` | All 28 booklet templates, filterable by style, plus a price table |
| Design / template detail | `Design.dc.html` | One template: preview pages, pick options, start personalising |
| Reviews | `Reviews.dc.html` | Trustpilot summary, featured reviews, live review feed |
| Contact | `Contact.dc.html` | Phone, email, visit by appointment, contact form |

Removed on purpose: the separate "How it works" section and the "Prices" item in the main menu. Prices still appear on product cards, in the table on the booklets page, and through the price calculator link.

## Design tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| `--plum` | `#5A2760` | Brand colour: primary buttons, links, active states, accents |
| `--plum-hover` | `#45204B` | Primary button hover |
| `--plum-deep` | `#3E1A43` | Utility bar, dark promo cards, link hover |
| `--plum-night` | `#2E1631` | Footer background |
| `--ink` | `#2B2230` | Headings and main text |
| `--text-2` | `#4E4552` | Body copy, descriptions |
| `--text-3` | `#5E5560` | Captions, meta text, breadcrumbs (still passes 4.5:1 on the background) |
| `--text-label` | `#6A5F6C` | Small uppercase labels |
| `--paper` | `#FBF8F5` | Page background (warm off-white) |
| `--surface` | `#FFFFFF` | Cards, header, alternate sections |
| `--mist` | `#F3ECF2` | Tinted section background |
| `--mist-2` | `#F5EFF4` | Product image backgrounds, hover fills |
| `--mist-3` | `#F1E8F0` | Hero and gallery backdrops |
| `--line` | `#ECE3EA` | Card borders, section dividers |
| `--line-2` | `#D9CCD7` / `#DCCDD9` | Chip borders, list dividers |
| `--field-border` | `#CFC0CC` | Form input borders |
| `--star` | `#1F6B45` | Trustpilot stars |
| `--success-bg` / `--success-border` / `--success-text` | `#EEF5F0` / `#BFD9C8` / `#1F4D33` | Form sent confirmation |
| Placeholder hatch | `#EDE3EC` / `#E5D8E4` | Striped photo placeholders (dev only, replace with real images) |

### Type

- **Display (headings, prices, quotes):** Newsreader, a Google Font. Weights 400 and 500, plus 400 italic. Fallback: Georgia, serif.
- **Body and UI:** Work Sans, a Google Font. Weights 400, 500 and 600. Fallback: 'Helvetica Neue', sans-serif.
- Google Fonts URL: `https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=Work+Sans:wght@400;500;600&display=swap`
- **Base body size is 18px with line-height 1.6.** This is deliberately large, because many customers are older.

| Role | Font | Size | Notes |
|---|---|---|---|
| H1, home hero | Newsreader 400 | `clamp(42px, 5vw, 66px)`, lh 1.06 | Second clause in italic plum |
| H1, inner pages | Newsreader 400 | `clamp(40px, 4.4vw, 58px)`, lh 1.08 | |
| H2, section | Newsreader 400 | `clamp(34px, 3.6vw, 46px)`, lh 1.1 | Smaller sections use `clamp(30px, 3vw, 38px)` |
| H3, card title | Newsreader 500 | 21–26px | |
| Eyebrow / label | Work Sans 600 | 13–15px | Uppercase, letter-spacing 0.1–0.14em |
| Lede | Work Sans 400 | 20px | |
| Small / meta | Work Sans | 15–16px | |

Use `text-wrap: balance` on headings and `text-wrap: pretty` on paragraphs.

### Layout, spacing and shape

- **Content width:** max 1200px, centred, 32px side padding.
- **Section padding:** 80–96px top and bottom.
- **Card padding:** 24–48px.
- **Gaps:** 12, 16, 20, 24, 28, 32, 40, 48, 56, 64px.
- **Corner radius:** 8px for buttons and inputs, 12px for cards, 16px for large panels and the help band, 999px for chips and pills. Product cover mockups use 3px.
- **Shadows:** covers use `0 8px 22px rgba(62,26,67,.12)`; on hover they use `0 18px 40px rgba(62,26,67,.16)` and lift 4px. The dropdown uses `0 20px 48px rgba(62,26,67,.14)`.
- **Grids collapse on their own.** Use `repeat(auto-fit, minmax(min(<N>px, 100%), 1fr))` so they stack on phones without media queries.
- **Touch targets:** at least 44px everywhere. Primary buttons are 52–58px tall.

## Shared components

1. **Utility bar** (`--plum-deep`, 15px text). Left: "Order by **11am** for next-working-day delivery across the UK". Right: phone icon and a `tel:` link reading "Mon–Fri 9am–6pm · 020 7277 7663".
2. **Header** (white, bottom border). From left to right:
   - Logo, 56px tall, linking home.
   - Main menu: **Shop ▾**, Reviews, Contact.
   - Sign in (ghost button) and Basket (outlined plum button with a count).
   - The current page is marked with plum text, a 2px plum underline and `aria-current="page"`.
3. **Shop dropdown.** A real `<button>` with `aria-expanded` and `aria-controls`. The panel is 320px wide and grouped:
   - For the service: Order of Service booklets, Bookmarks, Memorial cards, Memorial photos
   - After the service: Thank you cards, Pet sympathy cards
   - Other ways to order: We design it for you, Upload your own design

   In production, also close it on Esc, on an outside click and when a link is chosen. Open it on click, not hover.
4. **Footer** (`--plum-night`). Four columns:
   - Logo on a white chip, plus the tagline.
   - Shop: every product.
   - Help: Price calculator, Reviews, FAQs, Resources, Contact.
   - Get in touch: phone, email, hours, address, "Visits by appointment".

   Bottom row: "© The Funeral Stationery · Bluwave Ltd", Privacy policy, Terms & conditions.
5. **Buttons.**
   - Primary: plum fill, white text, 8px radius.
   - Ghost: transparent, with a mist fill on hover.
   - Outlined: 1.5px plum border.
   - On dark backgrounds: white fill with plum-deep text, or a white outline.
6. **Filter chips.** Toggle buttons using `aria-pressed`. On: plum fill, white text. Off: white with a `--line-2` border, which turns plum on hover.
7. **Product card.** Tinted image area, cover mockup, eyebrow label, Newsreader title, short description and a "From £X for N" line. The whole card is one link.
8. **Dark promo card** ("We design it for you") and **dashed outline card** ("Upload your own design").
9. **Review card.** Five green stars, a Newsreader quote title, body text, then the name and "Verified buyer". Use `<figure>`, `<blockquote>` and `<figcaption>`.
10. **Help band.** A plum panel with "Not sure where to start? We're here to help.", a white phone button and an outlined "Email us" button.
11. **Form fields.** Visible `<label>` on every field. Inputs are 52px tall with a 1.5px border and 8px radius. On focus: plum border plus a 3px `#D9C2D8` outline.

## Pages

### Home (`Main.dc.html`)

Sections in order:

1. Utility bar and header.
2. **Hero, two columns.**
   - Left: eyebrow "Order of Service booklets"; H1 "A beautiful order of service, *ready in time for the day.*"; lede; three bullets with ticks (11am cut-off, from £33.00 for 15 copies, upload from Canva); primary "Browse designs" button plus a text link "Upload your own design"; a Trustpilot line ("4.9 out of 5 from 164 reviews").
   - Right: two overlapping booklet covers on an arched tint, with the badge "A5 · 148 × 210 mm · heavyweight paper".
3. **"Choose a design to begin":** four design cards and a "See all 28 designs" link to the booklets page.
4. **"Everything else for the day, and after":** six cards (bookmarks, memorial cards, thank you cards, memorial photos, pet sympathy cards, and the dark "We can design it for you" card).
5. **"Printed properly, delivered on time":** a photo on the left, and on the right a three-row list (heavyweight paper; next-working-day delivery £10; standard turnaround 24–72 hours, call if urgent).
6. **Reviews:** the rating summary and two review cards.
7. Help band, then footer.

### Shop (`Shop.dc.html`)

1. Breadcrumb, H1 "Funeral stationery", lede.
2. Filter chips: Everything, For the service, After the service, Other ways to order. These filter on the client side.
3. A full-width featured card for Order of Service booklets (Most popular, 28 designs, from £33.00), linking to the booklets page.
4. Product grid. Each card shows its category label and a "From [£ price] for [qty]" line.
5. Reassurance strip (delivery, paper, phone), then footer.

### Order of Service booklets (`Booklets.dc.html`)

1. Breadcrumb, H1 and lede on the left; three fact tiles on the right (prices from, delivery, order by).
2. **Sticky filter bar:** All designs, With a photo, Religious, Floral, Simple, plus "Showing N of 28 designs". In production these should come from WooCommerce product tags or attributes.
3. Template grid using `auto-fill` with a 240px minimum. Each card shows the cover, the template name and "Colour · from £33.00", and links to the detail page. A "Show more designs" button sits underneath. Pagination or load-more is the developer's choice.
4. "Prices at a glance" table: copies down the side, page counts across the top. It scrolls sideways on small screens. Link to the price calculator.
5. "Can't find the right design?" with the design-for-you and upload cards.

### Design / template detail (`Design.dc.html`)

1. Breadcrumb: Home / Shop / Order of Service booklets / {Template}.
2. **Gallery, left side:** a large preview on a tinted panel, with three toggle buttons (Front cover, Inside pages, Back cover) that switch the preview.
3. **Buy box, right side:**
   - Eyebrow, H1 with the template name, and a short description.
   - **Colour:** round swatch buttons, 44px, with a ring on the selected one and the colour name shown.
   - **Pages:** buttons for 4, 8, 12.
   - **Copies:** buttons for 15, 25, 50, 100, plus "Need more than 100? Ask us for a price".
   - **Summary panel:** "{qty} copies · {pages} pages", the live price, a delivery note, and the primary **"Personalise this design"** button (this goes to the personalisation editor), with the note "Nothing is printed until you order."
   - Below that, a link for having them design it instead.
4. "What you can personalise": four ticked items.
5. Expandable sections using `<details>`: Size and paper; Delivery and timings; Photos that print well.
6. "You may also need": bookmarks, memorial cards, thank you cards.

### Reviews (`Reviews.dc.html`)

1. H1 "What families say about us" and lede.
2. Rating panel: 4.9, stars, "Based on 164 reviews on Trustpilot", "Read all on Trustpilot", "Ordered with us? Leave a review".
3. Two featured reviews (real ones from the current site).
4. **"All reviews": embed the official Trustpilot widget here.** Never copy reviews in by hand or write your own.
5. "Ready when you are" call-to-action band, then footer.

### Contact (`Contact.dc.html`)

1. H1 "We're here to help", lede, and an urgent-request note: "Is the funeral in the next few days? Please call us…"
2. **Left column:** three cards.
   - Call us: number and hours.
   - Email us: address, plus "Urgent request? Say so in the subject line."
   - Visit us, by appointment: full address, then a map.
3. **Right column:** the form.
   - Fields: Name; Phone (optional); Email; "What's it about?" (a select listing all products, plus "An existing order" and "Something else"); "Date of the service (if known)" as a date input; Message.
   - Button: "Send message".
   - On success, show a confirmation using `role="status"`.

## Interactions in the mockups

These are client-side state in the mockup and should be rebuilt properly:

- Shop dropdown opens and closes.
- Filters on Shop and Booklets.
- On the detail page: switching gallery views, choosing colour, pages and copies, and the live price.
- Contact form shows a confirmation when sent.
- Card hover lifts the cover 4px and deepens its shadow.

## Accessibility (required)

- Use real `<button>`, `<a href>`, `<input>` and `<label>` elements. Never put a click handler on a div.
- Toggles use `aria-pressed`. The dropdown uses `aria-expanded`.
- Icon-only controls have an `aria-label`. Decorative SVGs have `aria-hidden="true"`.
- Text contrast is at least 4.5:1. All the text colours above have been checked against `--paper` and white.
- Touch targets are at least 44px. Form fields are at least 52px.
- Use landmarks: `header`, `nav` with `aria-label`, `main`, `footer`, and a breadcrumb `nav`.

## Content: open questions for the owner (do not guess)

1. **Order cut-off time.** The live site says **10am** and the new design says **11am**. Confirm one and use it everywhere.
2. **Turnaround.** "24–72 hours" sits alongside "next working day". Confirm the wording.
3. **Prices.** Only "£33.00 for 15 copies" is confirmed. Every `[£ price]`, `[qty]` and `[size]` is a placeholder. The rest should come from WooCommerce or the existing price calculator.
4. **Booklet options.** The 4/8/12 pages, 15/25/50/100 copies and colour variants are **assumptions**. Use the real product attributes.
5. **Template names and filter categories.** Classic Cross, Portrait Oval, Olive Sprig, Full Photo and the colour names are stand-ins. Use the real 28 templates and their real cover images.
6. **"We design it for you."** This is a rename of the current "Customisation Services". Confirm what the service actually covers.
7. **Personalisation editor.** Confirm it shows a live preview before claiming "Nothing is printed until you order" or "You'll see your booklet as you go".
8. **Contact reply time.** It reads `[response time]`.
9. **Trustpilot.** Swap in the business's own Trustpilot profile URL and the widget embed code.
10. **Photos.** Every striped area is a placeholder for real photography: printed booklets, product shots and cover images.
11. **Logo.** Get the original vector file.
12. **Canva uploads.** Confirm which file types the upload accepts.

Product descriptions on the cards are draft copy. Ask the owner to approve them.

## Reading the source files

`source/*.dc.html` use a design-canvas component format, so they aren't drop-in templates. Read them for exact values and structure:

- **All styling is inline** in `style="…"`. Shared hover rules are in the `<style>` block inside `<helmet>`.
- **`{{name}}` is a template variable.** Its value comes from `renderVals()` in the `<script type="text/x-dc">` block at the bottom of each file.
- **`<sc-for list="{{items}}" as="item">`** repeats its contents once per item, like a loop.
- **`<sc-if value="{{cond}}">`** shows its contents only when the condition is true.
- **`onClick="{{fn}}"`** attaches a click handler returned from `renderVals()`.
- **Links between pages** point at `Page.dc.html`. Map them to real routes:

  | Source file | Route |
  |---|---|
  | `Main.dc.html` | `/` |
  | `Shop.dc.html` | `/shop` |
  | `Booklets.dc.html` | `/order-of-service` |
  | `Design.dc.html` | `/order-of-service/{template}` |
  | `Reviews.dc.html` | `/reviews` |
  | `Contact.dc.html` | `/contact` |

- **`/_blob/3971a44f…`** is the logo. Use `assets/logo.png`.
- **Header and footer markup is repeated in every file.** Build each once as a shared component or template part.

## Suggested first prompt for Claude Code

> Read `HANDOFF.md` and the files in `source/`. Look at our existing codebase and tell me the stack, then propose a plan to implement the design tokens, the shared header/footer/dropdown, and the six pages in it. Reuse existing WooCommerce data for products, prices and options rather than hard-coding them. List every open question from the handoff that blocks you before writing code.
