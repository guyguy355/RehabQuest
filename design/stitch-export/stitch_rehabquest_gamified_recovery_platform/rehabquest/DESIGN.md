---
name: RehabQuest
colors:
  surface: '#fbf9f9'
  surface-dim: '#dbdad9'
  surface-bright: '#fbf9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f3'
  surface-container: '#efeded'
  surface-container-high: '#e9e8e7'
  surface-container-highest: '#e3e2e2'
  on-surface: '#1b1c1c'
  on-surface-variant: '#3f4a36'
  inverse-surface: '#303031'
  inverse-on-surface: '#f2f0f0'
  outline: '#6f7b64'
  outline-variant: '#becbb1'
  surface-tint: '#2b6c00'
  primary: '#2b6c00'
  on-primary: '#ffffff'
  primary-container: '#58cc02'
  on-primary-container: '#1e5000'
  inverse-primary: '#6be026'
  secondary: '#006590'
  on-secondary: '#ffffff'
  secondary-container: '#2fb8ff'
  on-secondary-container: '#004666'
  tertiary: '#7d5800'
  on-tertiary: '#ffffff'
  tertiary-container: '#e9a700'
  on-tertiary-container: '#5c4000'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#87fe45'
  primary-fixed-dim: '#6be026'
  on-primary-fixed: '#082100'
  on-primary-fixed-variant: '#1f5100'
  secondary-fixed: '#c8e6ff'
  secondary-fixed-dim: '#88ceff'
  on-secondary-fixed: '#001e2e'
  on-secondary-fixed-variant: '#004c6e'
  tertiary-fixed: '#ffdea9'
  tertiary-fixed-dim: '#ffba26'
  on-tertiary-fixed: '#271900'
  on-tertiary-fixed-variant: '#5e4100'
  background: '#fbf9f9'
  on-background: '#1b1c1c'
  surface-variant: '#e3e2e2'
typography:
  headline-xl:
    fontFamily: Lexend
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Lexend
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Lexend
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Nunito Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
  body-md:
    fontFamily: Nunito Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Lexend
    fontSize: 16px
    fontWeight: '700'
    lineHeight: 20px
  label-sm:
    fontFamily: Lexend
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
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
  sm: 16px
  md: 24px
  lg: 32px
  xl: 48px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
---

## Brand & Style

This design system is built to transform the often-tedious process of physical and cognitive rehabilitation into an engaging, high-energy journey. The brand personality is **motivational, tactile, and resilient**, balancing the whimsy of a gaming interface with the clinical reliability required for healthcare. 

The aesthetic leverages a **Tactile / Bold** style. It moves away from the sterile, thin-lined "medical" look toward a "sticker" or "app-first" feel. By using chunky physical metaphors—like buttons that physically depress and cards with thick, protective borders—the interface provides users with a sense of impact and progress with every interaction. It is designed to be highly accessible for users who may have motor or cognitive impairments, ensuring targets are large, contrast is high, and the path forward is always unmistakably clear.

## Colors

The palette is driven by functional high-energy hues that signal progress and state changes immediately:
- **Success Green (#58cc02):** The primary driver for "Correct," "Complete," and "Go." Use this for main action buttons and progress completion.
- **Action Blue (#1cb0f6):** The secondary color for informational cues, navigation, and interactive elements that aren't the primary path.
- **Warning Orange (#ffb700):** Used for streaks, currency (points/gems), and alerts that require attention but aren't yet critical.
- **Critical Red (#ff4b4b):** Reserved for errors, missed goals, or dangerous actions.
- **Neutral/Surface:** A pure white background provides a clean canvas, while a light grey (#e5e5e5) is used for the thick 2px borders to define the "sticker" edges without overwhelming the vibrant brand colors.

## Typography

The typography strategy focuses on readability and friendliness. 
- **Headings:** Utilize **Lexend** with extra-bold weights. Its wide apertures and geometric, rounded forms feel athletic and clear, ideal for motivational headers and milestone celebrations.
- **Body:** **Nunito Sans** provides a softer, more organic feel for longer instructional text, ensuring the medical advice feels approachable and gentle.
- **Labels:** Button text and UI labels use Lexend in uppercase to maintain a "game-ui" feel that is easy to scan at a glance.
- **Scaling:** On mobile devices, `headline-xl` should scale down to 30px to prevent excessive line-breaking.

## Layout & Spacing

The layout follows a **Fluid Grid** model with generous margins to ensure the UI feels airy and un-cluttered.
- **Mobile:** 4-column grid with 20px side margins and 16px gutters.
- **Desktop:** 12-column grid with a max-width of 1200px, centered on the page.
- **Rhythm:** Spacing is strictly based on a **4px baseline**. Most containers utilize `md` (24px) padding to accommodate the thick 2px borders without making the content feel cramped. 
- **Vertical Flow:** Stacked cards and list items should use `sm` (16px) spacing to maintain a clear relationship between grouped tasks, while major sections use `xl` (48px) to define distinct phases of a workout or rehab session.

## Elevation & Depth

This system rejects soft, ambient shadows in favor of **Bold Borders and Offset Shadows**. Depth is communicated through a 3D "layered" look:
- **3D Effect:** Interactive elements (buttons, active cards) feature a solid color bottom-border offset (usually 4px to 6px deeper than the surface color). This gives the impression of a physical block that can be pressed down.
- **Sticker Borders:** All non-interactive containers use a 2px solid border in a shade slightly darker than the surface (#e5e5e5). This creates a "cut-out" or "sticker" aesthetic.
- **Active State:** When pressed, the 3D offset disappears (translation Y), simulating a physical button click. This tactile feedback is crucial for users with limited dexterity.

## Shapes

The shape language is consistently **Rounded**, avoiding sharp corners to maintain a safe, friendly, and approachable atmosphere. 
- **Standard Corners:** Most buttons and cards use a 16px (1rem) radius.
- **Progress Bars:** Use fully rounded pill-shapes (999px) to convey smoothness and fluid movement.
- **Icons:** Should be contained within circular or soft-square "plates" to further emphasize the sticker aesthetic.

## Components

- **Buttons:** Large, chunky blocks with a 4px bottom-border offset. The primary button uses Success Green with a darker green shadow. Label text is always bold and centered.
- **Cards:** White backgrounds with 2px solid #e5e5e5 borders. Cards should have a subtle 2px bottom-offset to distinguish them from flat decorative elements. 
- **Progress Bars:** Thick (minimum 16px height) tracks with a grey background and a vibrant green fill. The leading edge of the progress fill should be rounded.
- **Input Fields:** Thick 2px borders that turn Action Blue when focused. The 3D bottom-shadow is inverted (inset) to make the field feel like it is carved "into" the page.
- **Chips/Badges:** Pill-shaped with a 2px border. Used for exercise tags (e.g., "Strength," "Balance") or difficulty levels.
- **Lists:** Items are separated by thick horizontal rules or placed within individual "sticker" cards for a more modular, game-like appearance.
- **Iconography:** Use a consistent 2px or 3px stroke weight with rounded caps and joins. Icons should be expressive and slightly oversized to ensure ease of tapping.