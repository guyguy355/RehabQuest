---
name: RehabQuest Design System
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#3f4850'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#6f7881'
  outline-variant: '#bec7d1'
  surface-tint: '#006492'
  primary: '#006492'
  on-primary: '#ffffff'
  primary-container: '#2d9cdb'
  on-primary-container: '#003049'
  inverse-primary: '#8ccdff'
  secondary: '#006d41'
  on-secondary: '#ffffff'
  secondary-container: '#95f7bb'
  on-secondary-container: '#007346'
  tertiary: '#904d00'
  on-tertiary: '#ffffff'
  tertiary-container: '#d38033'
  on-tertiary-container: '#482300'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cae6ff'
  primary-fixed-dim: '#8ccdff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004b6f'
  secondary-fixed: '#95f7bb'
  secondary-fixed-dim: '#7adaa1'
  on-secondary-fixed: '#002110'
  on-secondary-fixed-variant: '#005230'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Manrope
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  display-lg-mobile:
    fontFamily: Manrope
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  container-margin: 20px
  gutter: 16px
---

## Brand & Style

The brand personality is rooted in **Clinical Empathy**—a balance of rigorous medical professionalism and warm, encouraging support. This design system is built to facilitate physical and cognitive rehabilitation, requiring a UI that feels reliable enough for a clinician but approachable enough for a patient in recovery.

The visual style is **Modern Corporate with Tactile Gamification**. It utilizes a clean, spacious layout inspired by modern SaaS, but incorporates subtle "life" through progress-oriented elements. The emotional response should be one of "Structured Progress"—patients should feel that their recovery is organized, tracked, and achievable. The "gamified" elements are treated as medical milestones rather than arcade rewards, using sophisticated iconography and muted secondary tones to maintain high-quality healthcare standards.

## Colors

The palette is designed for high legibility and psychological calm. 

- **Primary (Soft Teal & Deep Blue):** Soft Teal (#2D9CDB) serves as the main action color for buttons and active states. Deep Healthcare Blue (#1F2937) provides the structural weight, used for headings and primary navigation to establish authority.
- **Secondary (Mint Green):** Used exclusively for "Progress" and "Success" states. It signifies healing and completion of rehabilitation tasks.
- **Accents (Soft Amber):** Reserved for "Streak" mechanics and motivational alerts. It provides a warm contrast to the cooler teal/blue base without appearing alarming.
- **Neutrals:** A range of grays from #6B7280 (secondary text) to #E5E7EB (borders) ensures a clean hierarchy.
- **Accessibility:** All text-on-background combinations must meet WCAG AA standards. Interactive teal elements should use white text, while mint green elements should use the deep blue for maximum contrast.

## Typography

This design system uses a dual-font approach to balance modernity with utility. **Manrope** is used for headings to provide a sophisticated, slightly rounded geometric feel that aligns with the "approachable professional" vibe. **Inter** is used for all functional body text and interface labels due to its exceptional legibility in medical contexts and data-heavy screens.

For mobile-first optimization, font sizes rarely dip below 14px to ensure readability for patients who may have visual impairments or motor-control challenges. Line heights are kept generous to prevent "text-crowding," which can be overwhelming during cognitive rehab exercises.

## Layout & Spacing

The layout philosophy follows a **Fluid Grid** model with a heavy emphasis on 8px increments. 

- **Mobile (Default):** A 4-column grid with 20px side margins. Large touch targets (minimum 48px height) are mandatory. 
- **Tablet/Desktop:** Scales to a 12-column grid. Content containers are capped at 1140px to ensure line lengths remain readable.
- **Bottom Navigation:** On mobile, primary actions and navigation are anchored to the bottom for ease of one-handed use, critical for patients with limited range of motion.
- **Rhythm:** Use "md" (16px) for internal card padding and "lg" (24px) for vertical section spacing.

## Elevation & Depth

This design system uses **Ambient Shadows** and **Tonal Layering** to create a sense of organized depth.

- **Level 0 (Base):** Light gray (#F9FAFB) background.
- **Level 1 (Cards):** White surfaces with a very soft, diffused shadow: `0px 4px 12px rgba(31, 41, 55, 0.05)`.
- **Level 2 (Interactive/Hover):** Increased shadow depth to indicate lift: `0px 8px 24px rgba(31, 41, 55, 0.08)`.
- **Level 3 (Modals/Overlays):** `0px 12px 32px rgba(31, 41, 55, 0.12)`.

Avoid heavy black shadows. Shadows should feel like they are cast by soft, clinical overhead lighting. Elements that are "inactive" or "disabled" lose their shadow and recede into the background color.

## Shapes

The shape language is consistently **Rounded**, utilizing a 12px to 16px radius. This specific range is chosen to soften the "sterile" feel of healthcare without becoming overly playful or "bubbly."

- **Primary Buttons & Cards:** 12px radius.
- **Large Containers/Imagery:** 16px radius.
- **Small Components (Tags/Badges):** 8px or fully pill-shaped.
- **Progress Bars:** Fully rounded (caps) to visualize fluid movement.

## Components

- **Buttons:** Primary buttons use Soft Teal with a 12px radius. Secondary buttons use a Deep Blue outline. All buttons must maintain a 48px minimum height for accessibility.
- **Cards:** White backgrounds with Level 1 shadows. Cards used for "Exercise Sessions" should feature a Mint Green progress bar at the bottom.
- **Input Fields:** Use a 1px border (#E5E7EB) that thickens and changes to Soft Teal on focus. Labels always sit above the field in **label-md** typography.
- **Gamified Elements:**
    - **Progress Paths:** A vertical or horizontal "node-and-line" system using Soft Teal for completed steps and Light Gray for upcoming ones.
    - **Streak Badges:** A Soft Amber flame or star icon contained within a Deep Blue circle.
    - **Milestone Badges:** Hexagonal shapes with minimalist healthcare icons (e.g., a heart, a flexing arm, a brain) in Teal or Mint.
- **Bottom Navigation:** A persistent bar on mobile using clear icons and 12px labels. The "active" state uses a Soft Teal icon and a small dot indicator below it.
- **Chips/Filters:** Used for exercise categories (e.g., "Mobility," "Strength"). These should be pill-shaped with light teal backgrounds and dark teal text.