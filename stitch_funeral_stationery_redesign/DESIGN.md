---
name: Serene Legacy
colors:
  surface: '#fff7fa'
  surface-dim: '#e2d7dd'
  surface-bright: '#fff7fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fcf0f7'
  surface-container: '#f7ebf1'
  surface-container-high: '#f1e5eb'
  surface-container-highest: '#ebdfe5'
  on-surface: '#1f1a1e'
  on-surface-variant: '#4f434c'
  inverse-surface: '#352f33'
  inverse-on-surface: '#faeef4'
  outline: '#81737d'
  outline-variant: '#d3c2cd'
  surface-tint: '#874685'
  primary: '#511552'
  on-primary: '#ffffff'
  primary-container: '#6b2d6a'
  on-primary-container: '#e69adf'
  inverse-primary: '#fbadf3'
  secondary: '#226b3d'
  on-secondary: '#ffffff'
  secondary-container: '#a9f4b9'
  on-secondary-container: '#297143'
  tertiary: '#263400'
  on-tertiary: '#ffffff'
  tertiary-container: '#394c00'
  on-tertiary-container: '#a5bd67'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffd6f7'
  primary-fixed-dim: '#fbadf3'
  on-primary-fixed: '#37003a'
  on-primary-fixed-variant: '#6c2e6b'
  secondary-fixed: '#a9f4b9'
  secondary-fixed-dim: '#8dd79f'
  on-secondary-fixed: '#00210d'
  on-secondary-fixed-variant: '#005228'
  tertiary-fixed: '#d3ed92'
  tertiary-fixed-dim: '#b7d078'
  on-tertiary-fixed: '#151f00'
  on-tertiary-fixed-variant: '#3a4d01'
  background: '#fff7fa'
  on-background: '#1f1a1e'
  surface-variant: '#ebdfe5'
  canvas-cream: '#F4F1EE'
  soft-sage: '#E8F0EA'
  mourning-gray: '#4A4A4A'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Work Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Work Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-max: 1200px
  gutter: 24px
  margin-mobile: 16px
  section-gap: 80px
  element-gap: 24px
---

## Brand & Style

The design system is centered on **Compassionate Professionalism**. Dealing with end-of-life services requires a UI that feels steady, premium, and deeply empathetic. The aesthetic moves away from the cluttered, transactional nature of the original site toward a **Minimalist / Corporate Modern** hybrid that prioritizes emotional breathing room.

The visual narrative is "The Gentle Guide." We use generous white space to reduce cognitive load during stressful times. The style incorporates soft, organic transitions and a tactile quality that mirrors the physical nature of high-quality stationery. The goal is to evoke a sense of relief, trust, and quiet dignity.

## Colors

This design system evolves the heritage palette into more sophisticated, muted tones. The primary purple is deepened to a plum-wine shade (#6B2D6A) to increase contrast and convey "premium tradition." The green is shifted to a deep forest shade (#0D5C30) for a grounding effect.

Instead of stark whites, we utilize `canvas-cream` as the primary background to soften the visual impact. Gradients should be extremely subtle "linear-to-transparent" fades, used primarily to give depth to headers or card backgrounds. The palette is designed to meet WCAG AA standards for legibility, ensuring the typography remains accessible to all age groups.

## Typography

We pair **Source Serif 4** with **Work Sans** to balance traditional sentiment with modern efficiency. Source Serif 4 provides a literary, authoritative feel for headings, suggesting the permanence of a printed tribute. Work Sans offers a clean, neutral counterpoint for functional text and product descriptions.

Hierarchy is established through scale and weight. Display sizes use tighter tracking for a bespoke look. Body text utilizes a generous 1.6 line height to ensure maximum readability for users who may be fatigued or under emotional stress.

## Layout & Spacing

The layout utilizes a **Fixed Grid** model on desktop to maintain an organized, boutique-like presentation. A 12-column grid is standard, but content should be centered within a 1200px container to prevent excessive eye travel.

Margins and section gaps are intentionally large (`section-gap: 80px`) to create a "gallery" feel. On mobile, we transition to a single-column fluid layout with 16px side margins. Elements are grouped using a base-8 rhythm, ensuring a consistent and predictable flow across the entire user journey.

## Elevation & Depth

To maintain a calm atmosphere, we avoid heavy, dark shadows. Instead, the system uses **Tonal Layers** and **Ambient Shadows**. 

Surfaces are differentiated primarily by subtle shifts in background color (e.g., a card using a slightly lighter cream than the page). Where depth is required—such as on product selection cards—we use ultra-diffused shadows (20px blur, 4% opacity) tinted with the primary purple color rather than pure black. This creates a soft "lift" that feels natural and non-threatening.

## Shapes

The shape language is **Rounded (Level 2)**. Sharp corners are avoided to ensure the UI feels approachable and gentle. Buttons use a 0.5rem radius, while larger product cards and containers utilize the `rounded-lg` (1rem) or `rounded-xl` (1.5rem) tokens. This curvature echoes the soft edges of high-end paper products and creates a visual metaphor for comfort and care.

## Components

### Buttons
Primary buttons use the deep purple (#6B2D6A) with white text and a 0.5rem radius. Secondary buttons should be outlined in the same purple or deep green, using a 1.5px border width. Hover states should be a soft tonal shift, never an aggressive color change.

### Cards
Product cards (e.g., for different stationery styles) feature a 1px soft-sage border and a very subtle ambient shadow. Images within cards should have a slight inner glow to mimic the look of printed stock.

### Input Fields
Fields use a solid `canvas-cream` background with a subtle bottom-border initially, expanding to a full 1px border on focus. This reduces visual noise until the user is ready to interact.

### Chips & Tags
Used for categories like "Floral," "Religious," or "Classic." These should have a pill shape, using low-saturation versions of the brand colors (e.g., soft sage background with deep green text).

### Step Indicators
For the customization process, use a clean, horizontal line with soft, numbered circles. Completed steps are marked with the deep green to signal progress and peace of mind.