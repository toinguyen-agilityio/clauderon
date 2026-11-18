---
version: "alpha"
name: "Mesh Gradient"
description: "Mesh Gradient visual system (designmd.app/library/mesh-gradient) applied to the Clauderon app shell: multi-point smooth gradients that blend many hues, organic cloud-like color transitions, frosted-glass surfaces."
colors:
  primary: "#7c6bff"
  background: "#0b0b16"
  surface: "#0b0b16"
  text: "#f5f4fb"
  accent: "#ff8fd6"
  on-primary: "#000000"
  on-surface: "#FFFFFF"
  on-accent: "#000000"
typography:
  h1:
    fontFamily: "'Cabinet Grotesk', 'Inter', sans-serif"
    fontSize: "4rem"
    fontWeight: "700"
    lineHeight: "1.05"
  body-md:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.6"
  label-caps:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: "600"
    letterSpacing: "0.06em"
rounded:
  sm: "10px"
  md: "16px"
  lg: "26px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "16px"
  button-secondary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: "24px"
  page:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    padding: "16px"
---

## Overview

Mesh Gradient visual system, translated from the Claude Artisan catalog (MIT, imported via designmd.app). Multi-point smooth gradients that blend many hues; organic, cloud-like color transitions.

- **Category:** morphism
- **Era:** 2021–present
- **Origin:** Popularized by design tools (mesh gradient generators, Figma plugins).
- **Reference:** Stripe backgrounds; Apple event key art.
- **Structural base:** application shell with navigation and cards

**Defining traits:**
- Multi-point smooth gradients that blend many hues
- Organic, cloud-like color transitions
- Used as the page backdrop
- Slowly animated / shifting

## Colors

- **bg** — #0b0b16
- **surface** — rgba(255, 255, 255, 0.06)
- **surface-strong** — rgba(255, 255, 255, 0.11)
- **border** — rgba(255, 255, 255, 0.14)
- **text** — #f5f4fb
- **text-muted** — rgba(245, 244, 251, 0.70)
- **primary** — #7c6bff
- **accent** — #ff8fd6
- **mesh-a** — #4f46e5
- **mesh-b** — #06b6d4
- **mesh-c** — #f472b6
- **mesh-d** — #fbbf24

Status colors (running, waiting, OK, failed, interrupted) use a light tint of the hue on a translucent tinted background of the same hue.

## Typography

- Display: 'Cabinet Grotesk', 'Inter', sans-serif (the app falls back to Inter 700)
- Body: 'Inter', system-ui, -apple-system, sans-serif
- Mono: 'JetBrains Mono', ui-monospace, monospace — for anything that comes from git, GitHub or a Pod

## Layout

- Application shell: fixed glass sidebar with navigation, work area of glass cards.
- Use a responsive grid and preserve content hierarchy.
- Collapse columns below 768px without horizontal overflow.

## Elevation & Depth

- The mesh gradient is a fixed backdrop (4 radial blobs, blurred, drifting over ~28s); it never scrolls with content.
- Surfaces are frosted glass: translucent fill, 1px light border, `backdrop-filter: blur(18px)`. Modals use a solid surface for legibility.
- Entry animations: fade + translate-Y (14px → 0) over 480ms ease-out, staggered 80ms.
- Hover: color/border/shadow shift over 200ms; tiles lift 2px. Only transform and opacity animate for entrances.

## Shapes

- Radius scale: 10px (controls), 16px (cards), 26px (modals, sign-in).

## Components

- Buttons keep visible focus and predictable hover/pressed states. Primary: `#7c6bff` fill, black text.
- Cards use the surface and radius scale from the tokens.
- Forms expose persistent labels, textual errors, and keyboard focus.
- Active nav item: tinted primary background with an inset primary ring.

## Theme

Dark is the default. A Light / Dark toggle sits at the bottom of the sidebar; light uses a pale `#f3f2ff` base, translucent white glass, and primary `#5b49e8` with white text.

## Do's and Don'ts

- Do: follow the tokens and the structural composition.
- Do: maintain WCAG AA contrast and honor `prefers-reduced-motion` (the mesh stops drifting).
- Avoid: using the style as decoration without functional hierarchy.
