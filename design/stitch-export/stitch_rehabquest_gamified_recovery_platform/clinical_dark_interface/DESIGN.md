---
name: Clinical Dark Interface
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bec8d2'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#88929c'
  outline-variant: '#3e4850'
  surface-tint: '#8ccdff'
  primary: '#90cfff'
  on-primary: '#00344f'
  primary-container: '#38b6ff'
  on-primary-container: '#004566'
  inverse-primary: '#006493'
  secondary: '#4ddcc6'
  on-secondary: '#003730'
  secondary-container: '#00b4a0'
  on-secondary-container: '#003f37'
  tertiary: '#ffb5b9'
  on-tertiary: '#67001b'
  tertiary-container: '#ff8a94'
  on-tertiary-container: '#860026'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#cae6ff'
  primary-fixed-dim: '#8ccdff'
  on-primary-fixed: '#001e30'
  on-primary-fixed-variant: '#004b70'
  secondary-fixed: '#6ef9e2'
  secondary-fixed-dim: '#4ddcc6'
  on-secondary-fixed: '#00201b'
  on-secondary-fixed-variant: '#005047'
  tertiary-fixed: '#ffdadb'
  tertiary-fixed-dim: '#ffb2b7'
  on-tertiary-fixed: '#40000d'
  on-tertiary-fixed-variant: '#92002a'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Manrope
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  data-tabular:
    fontFamily: Manrope
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Manrope
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.03em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

This design system utilizes a **Corporate / Modern** aesthetic tailored specifically for a high-stakes clinical environment. The dark mode transition prioritizes cognitive load reduction for practitioners while maintaining a sense of authoritative precision.

The style is characterized by deep, saturated foundations and vibrant, high-contrast data points. By moving away from stark black to a nuanced navy-charcoal, the interface reduces eye strain during long-duration monitoring. The visual language conveys reliability, scientific rigor, and calm under pressure through clean lines, ample negative space within containers, and a focus on information density without clutter.

## Colors

The palette is engineered for clinical clarity. The primary background uses a deep navy/charcoal (`#0f172a`) to provide a stable foundation. Interactive elements utilize an adjusted Teal (`#38b6ff`), lightened from the brand original to ensure a 4.5:1 contrast ratio against dark surfaces. The Mint Green (`#5eead4`) serves as a secondary accent for "success" states and positive health indicators.

**Color Tiers:**
- **Base:** Deep charcoal for the application canvas.
- **Surface:** Progressive lightening of the navy base to indicate elevation and grouping.
- **Accents:** High-vibrancy teal and mint, used sparingly to direct attention.
- **Data:** High-contrast white and light-grey for critical readings and telemetry.

## Typography

This design system exclusively employs **Manrope** to balance modern aesthetics with technical legibility. 

- **Clinical Data:** Use `data-tabular` for numerical values; the semi-bold weight and increased letter spacing ensure numbers are distinguishable at a glance.
- **Hierarchy:** Headlines use tighter tracking and heavier weights to anchor sections.
- **Readability:** Body text uses a slightly increased line height (1.5x) to prevent "light bleed" which often occurs with light text on dark backgrounds. 
- **Accessibility:** Ensure that secondary labels never drop below 12px to maintain legibility for all users.

## Layout & Spacing

The design system follows a strict **8px grid** to ensure mathematical harmony across all components.

- **Grid System:** A 12-column fluid grid is used for desktop layouts with 24px gutters. For mobile, a 4-column system with 16px margins is standard.
- **Sectioning:** Large vertical gaps (40px+) are used to separate distinct clinical modules (e.g., Patient History vs. Real-time Vitals).
- **Density:** While the overall layout is spacious, internal card padding can be reduced to `md` (16px) for data-heavy tables to maximize screen real estate.

## Elevation & Depth

In this dark mode environment, depth is communicated through **Tonal Layering** and **Low-contrast Outlines** rather than heavy shadows.

- **Surface Levels:** 
    - Level 0 (Base): `#0f172a`
    - Level 1 (Cards/Containers): `#1e293b` 
    - Level 2 (Modals/Popovers): `#334155`
- **Borders:** Use a subtle 1px border (`#334155`) on Level 1 cards to provide crisp definition where the background and surface contrast is low.
- **Shadows:** Avoid shadows on static elements. Only apply a soft, large-radius black shadow with 40% opacity for floating elements like dropdowns or tooltips to "lift" them off the interface.

## Shapes

The shape language is defined by a consistent **8px (0.5rem)** corner radius. This "Rounded" setting provides a professional yet approachable feel that softens the technical nature of the clinical data.

- **Standard Elements:** Buttons, Input fields, and Cards all share the 8px radius.
- **Large Containers:** For significant layout sections, use `rounded-xl` (1.5rem) to create clear visual containment.
- **Exceptions:** Status indicators (pills) and notification badges may use a full pill-shape (999px) to distinguish them from interactive buttons.

## Components

- **Buttons:** Primary buttons use the adjusted Teal (`#38b6ff`) with white or very dark navy text. Secondary buttons should use an outlined style with the same Teal to avoid visual "heaviness."
- **Input Fields:** Backgrounds should be one step darker than the surface they sit on, or use a 1px border (`#475569`). Focus states must be clearly defined by a 2px Teal glow.
- **Cards:** Use the Level 1 surface (`#1e293b`). Title areas within cards should have a subtle bottom border to separate headers from content.
- **Data Visualizations:** Charts and graphs should use a palette of Teal, Mint, and an Alert Red (`#f43f5e`). Use thin, low-opacity grid lines to avoid cluttering the data view.
- **Status Chips:** Use high-chroma backgrounds with low-opacity (e.g., Mint at 20% opacity) with fully opaque text for "Success" or "Stable" states.
- **Clinical Tables:** Zebra striping is discouraged; instead, use thin horizontal dividers (`#334155`) to maintain a clean, professional aesthetic.