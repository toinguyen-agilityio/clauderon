---
version: "alpha"
name: "Arctic Forsythia Premium"
description: "Arctic Forsythia Premium visual system (designmd.app/library/arctic-forsythia-premium) applied to the Clauderon app shell: Scandinavian, airy and luminous, with cool neutrals, crisp borders and yellow used only as punctuation."
colors:
  arctic: "#F1F6F4"
  forsythia: "#FFC801"
  nocturnal: "#114C5A"
  mint: "#D9E8E2"
  saffron: "#FF9932"
  oceanic: "#172B36"
  on-primary: "#FFFFFF"
typography:
  h1:
    fontFamily: "'Outfit', 'Inter', sans-serif"
    fontSize: "2.25rem"
    fontWeight: "700"
  body-md:
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.6"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
rounded:
  sm: "8px"
  md: "16px"
  lg: "24px"
spacing:
  base: "8px"
components:
  button-primary:
    backgroundColor: "{colors.nocturnal}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
    padding: "12px"
  card:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.sm}"
    padding: "24px"
  page:
    backgroundColor: "{colors.arctic}"
    textColor: "{colors.oceanic}"
---

## Overview

Arctic Forsythia Premium, imported from designmd.app and adapted to an application shell instead of a landing page. Cool, luminous surfaces with generous space; one sharp yellow accent marks what needs attention.

- **Density:** airy; **Variance:** restrained; **Motion:** subtle.
- **Structural base:** Oceanic Noir sidebar with grouped navigation, a light work area of white cards.

## Colors

- **Arctic Powder** #F1F6F4: page background.
- **White** #FFFFFF: cards and dialogs (luminous against the powder page).
- **Mystic Mint** #D9E8E2: secondary surfaces, row hover, the dark theme's primary button.
- **Nocturnal Teal** #114C5A: headings, links, focus ring, primary button.
- **Oceanic Noir** #172B36: body text, the sidebar, the terminal, the selection bar, the dark theme base.
- **Forsythia Yellow** #FFC801: punctuation only, as the active nav mark, the Needs-you badge and the waiting state tint.
- **Deep Saffron** #FF9932: interrupted state.

Status pills use the hue as text on a light tint of the same hue; every hue encodes a state or output type.

## Typography

- **Headings:** Outfit, 600–700, slightly tight tracking, Nocturnal Teal.
- **Body and labels:** Inter, 14.5px / 1.6.
- **Data from git, GitHub or a Pod** (keys, branches, SHAs, commands): JetBrains Mono.

## Layout

- Application shell: sticky sidebar (228px) with navigation grouped as Work, Setup and Insight; content area max 1240px, 28px gaps between page sections.
- Pages with several views (Flows / Node library, pull request states) use underlined tabs with counts; each tab is a link. Flows are a searchable list with the samples pinned on top.
- The Node library is a grid of cards (Kind mark, name, description, Input → Output chips coloured by Output Type, Kind and Flow count); a card opens its editor in a dialog.
- Below 860px the sidebar becomes a top bar and multi-column grids stack, with no horizontal page overflow.

## Elevation & Depth

- Cards: 1px border `rgba(17,76,90,0.1)` plus a minimal shadow `0 2px 8px rgba(0,0,0,0.04)`; never heavier than `0 2px 8px rgba(0,0,0,0.08)`.
- No gradients; flat color only.
- Entry: fade + translate-Y (16px → 0) over 420ms ease-out, staggered 80ms.
- Hover: color, border and shadow shifts over 250ms; hovered tiles lift 2px. `prefers-reduced-motion` turns entries off.

## Shapes

- 8px for controls and cards, 16px for dialogs and the sign-in card, 24px reserved.

## Components

- **Primary button:** Nocturnal Teal fill, white text, 8px radius, 12px horizontal padding; hover darkens; pressed moves down 1px. No glows.
- **Secondary button:** 1.5px muted outline, subtle fill on hover.
- **Inputs:** label above, 1px border, 2px teal focus ring offset 2px, error text below.
- **Navigation:** Oceanic Noir surface in both themes; the active item gets a light fill, a 3px yellow mark, a yellow icon and weight 500. The footer holds the Member, a Light / System / Dark switch and a Sign out icon.

## Theme

Light is the default. A Light / System / Dark switch sits at the bottom of the sidebar (System follows the OS); dark uses an Oceanic Noir base (#12222B page, #172B36 cards), mint headings and a mint primary button with teal text.

## Do's and Don'ts

- Do: keep yellow as punctuation, never as a large background.
- Do: maintain WCAG AA contrast and honor `prefers-reduced-motion`.
- Don't: use emojis as icons, pure black, decorative gradients or heavy shadows.
