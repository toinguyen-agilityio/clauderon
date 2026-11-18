---
version: "alpha"
name: "Dark Mode"
description: "Dark Mode visual system (designmd.app/library/dark-mode) applied to the Clauderon app: near-black neutral backgrounds, desaturated accents, elevation through lighter surfaces instead of shadows."
colors:
  primary: "#7c9cff"
  background: "#0c0c10"
  surface: "#16161c"
  text: "#e8e8ec"
  accent: "#7fd9c4"
  on-primary: "#000000"
  on-surface: "#FFFFFF"
  on-accent: "#000000"
typography:
  h1:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "4rem"
    fontWeight: "700"
    lineHeight: "1.05"
  body-md:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.6"
  label-caps:
    fontFamily: "Inter, -apple-system, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: "600"
    letterSpacing: "0.06em"
rounded:
  sm: "4px"
  md: "8px"
  lg: "16px"
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

Dark Mode visual system, translated from the Claude Artisan catalog (imported via designmd.app). Minimal and organic.

- **Category:** minimal-organic
- **Era:** 2018–present (iOS / Android / macOS dark themes; Linear and developer tools)
- **Structural base:** application shell with navigation, surfaces and a responsive grid

**Defining traits:**
- Dark neutral backgrounds, never pure black
- Desaturated accents so colors do not vibrate
- Elevation through lighter surfaces instead of shadows
- Reduced eye strain, OLED-friendly contrast

## Colors

- **bg** — #0c0c10
- **surface** — #16161c
- **surface-strong** — #1e1e26 (hover, raised)
- **border** — rgba(255, 255, 255, 0.09)
- **text** — #e8e8ec
- **text-muted** — #9a9aa5
- **primary** — #7c9cff
- **accent** — #7fd9c4

Status colors (running, waiting, OK, failed, interrupted) are desaturated hues on a low-alpha tint of the same hue.

## Typography

- Display / body: Inter
- Mono: JetBrains Mono — for anything that comes from git, GitHub or a Pod

## Layout

- Application shell: fixed sidebar, work area of surface cards.
- Responsive grid; collapse columns below 768px without horizontal overflow.

## Elevation & Depth

- Raised elements get lighter surfaces (`#16161c` → `#1e1e26` on hover), not heavier shadows.
- Shadow scale: `0 1px 2px rgba(0,0,0,0.4)` · `0 4px 10px rgba(0,0,0,0.45)` · `0 12px 28px rgba(0,0,0,0.5)` (modals only for the largest).
- Motion: ease-out, 200ms transitions; entry fade + translate-Y (12px → 0) over 360ms, staggered 60ms. Honor `prefers-reduced-motion`.

## Shapes

- Radius: 8px for controls, 16px for cards and modals, 4px for tags.

## Components

- Buttons keep a visible focus indicator and predictable hover / pressed states. Primary: `#7c9cff` fill, black text.
- Cards use the surface color and radius tokens.
- Forms expose persistent labels, textual errors and keyboard focus.

## Theme

Dark is the default. A Light / Dark toggle sits at the bottom of the sidebar; light uses a pale `#f3f4f7` base, white surfaces and primary `#3b55d9` with white text.

## Do's and Don'ts

- Do: follow the tokens and the structural composition.
- Do: maintain WCAG AA contrast and respect `prefers-reduced-motion`.
- Don't: use the style as decoration without functional hierarchy.
