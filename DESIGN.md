---
version: "alpha"
name: "Precision Tech"
description: "Estilo de Tecnologia de Precisão (designmd.app/library/estilo-de-tecnologia-de-precisao) applied to the Clauderon app shell: precise and industrial, steel greys under a faint engineering grid, Industrial Blue for structure and Electric Blue as a signal."
colors:
  industrial-blue: "#003366"
  industrial-blue-deep: "#002D62"
  charcoal: "#36454F"
  silver: "#C0C0C0"
  light-grey: "#E0E0E0"
  white: "#FFFFFF"
  page: "#F3F5F7"
  ink: "#1E2A33"
  link: "#0066A8"
  electric-blue: "#00BFFF"
  orange: "#FFA500"
  green: "#008000"
typography:
  h1:
    fontFamily: "'Roboto', system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: "700"
  body-md:
    fontFamily: "'Roboto', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: "400"
    lineHeight: "1.6"
  label:
    fontFamily: "'Roboto', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: "500"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
spacing:
  base: "8px"
components:
  button-primary:
    backgroundColor: "{colors.industrial-blue}"
    textColor: "{colors.white}"
    rounded: "{rounded.sm}"
    padding: "12px"
  card:
    backgroundColor: "{colors.white}"
    border: "1px solid {colors.light-grey}"
    shadow: "0 2px 12px rgba(0,0,0,0.06)"
    rounded: "{rounded.sm}"
    padding: "24px"
  page:
    backgroundColor: "{colors.page}"
    textColor: "{colors.ink}"
---

## Overview

"Estilo de Tecnologia de Precisão" (Precision Technology Style), imported from designmd.app and adapted to an application shell instead of a chip landing page. Precise and industrial: steel greys, crisp 1px lines, a faint engineering grid behind the work, and two blues with distinct jobs.

- **Density:** airy (3/10); **Variance:** structured (2/10); **Motion:** subtle (4/10).
- **Structural base:** a Charcoal sidebar with grouped navigation beside a grid-lined grey page of white cards.

The source spec is partly contradictory and gives no dark theme; these are the choices we made:

- **Roles:** the front matter calls Charcoal the "accent" and Electric Blue the "surface"; the prose calls Industrial Blue the accent and white the surface. We follow the prose: Industrial Blue #003366 for headings and the primary button, white cards, Charcoal #36454F as the deep contrast surface (the sidebar), Electric Blue #00BFFF as a signal.
- **Navy:** the spec uses both #003366 (tokens) and #002D62 (CSS). #003366 is the base, #002D62 its hover.
- **Primary button text:** white instead of the spec's #E0E0E0 (12.6:1 instead of 9.6:1).
- **Contrast fixes:** Electric Blue (2.1:1 on white), Orange (2.0:1), Silver (1.8:1) and Light Grey (1.3:1) all fail as text on white. They appear only as fills, marks on dark surfaces, or borders; links and focus use a darker blue #0066A8 (6.1:1). Orange carries dark navy text (6.4:1).
- **Motion:** the spec's `transition: all 0.3s` conflicts with its own transform/opacity rule; we keep targeted 250ms transitions.
- **Dark theme, error red, tables and badges:** not in the spec; ours are below.

## Colors

- **Page** #F3F5F7 with a 24px engineering grid in `rgba(0,51,102,0.045)`. **White** #FFFFFF: cards and dialogs.
- **Ink** #1E2A33: body text (never pure black). Secondary text #36454F, tertiary #5A6670.
- **Industrial Blue** #003366: headings, the primary button and the sign-in hero; hover #002D62.
- **Link Blue** #0066A8: links, accent text and focus rings.
- **Charcoal** #36454F: the sidebar, with white and light-grey text.
- **Electric Blue** #00BFFF: signal only, as the active nav mark and icon on the Charcoal sidebar, the brand mark, step numbers and the running state.
- **Orange** #FFA500: attention, as the Needs-you badge and owner tag, with Industrial Blue text.
- **Green** #008000: success; text on light tints uses #006B00.
- **Light Grey** #E0E0E0 and **Silver** #C0C0C0: borders (card and strong).
- Error red #B3261E is our addition.

Status pills use the hue as text on a light tint of the same hue; every hue encodes a state or output type.

## Typography

- **Everything:** Roboto. Headings 700 with tight tracking (-0.02em), H1 up to 2.25rem, H2 1.15rem.
- **Body:** 14.5px / 1.6 in the app (dense data views), max 72ch for prose.
- **Labels:** 0.72–0.75rem, weight 500, slight letter-spacing.
- **Data from git, GitHub or a Pod** (keys, branches, SHAs, commands) and the brand mark: JetBrains Mono.

## Layout

- Application shell: sticky sidebar (228px) with navigation grouped as Work, Setup and Insight; content area max 1240px, 28px gaps between page sections.
- Pages with several views (Flows / Node library, pull request states) use underlined tabs with counts; each tab is a link.
- Below 860px the sidebar becomes a top bar and multi-column grids stack, with no horizontal page overflow.

## Elevation & Depth

- Cards: 1px #E0E0E0 border plus `0 2px 12px rgba(0,0,0,0.06)`.
- Lifted (hovered tiles, dialogs, hovered primary button): `0 2px 5px rgba(0,0,0,0.05), 0 8px 20px rgba(0,0,0,0.08)`.
- Pressed primary button: a small inset shadow and 1px down.
- The engineering grid is the only background texture; the sign-in hero carries the same grid in Electric Blue over Industrial Blue.

## Motion

- Hovers: color, border and shadow shifts over 250ms ease-out; hovered tiles lift 2px.
- Entry: fade + translate-Y (16px → 0) over 420ms ease-out, staggered 80ms.
- `prefers-reduced-motion` turns entries and transitions off.

## Shapes

- 8px for controls and cards, 12px for dialogs and the sign-in card, 16px reserved; pills are fully rounded.

## Components

- **Primary button:** Industrial Blue fill, white text, 8px radius, weight 600; hover deepens to #002D62 with a lift shadow; pressed moves down 1px. No glows.
- **Secondary button:** 1.5px silver outline, subtle fill on hover.
- **Inputs:** label above, 1px border, focus ring 2px Link Blue offset 2px (fields: blue border and soft halo), error text below in red. No floating labels.
- **Navigation:** Charcoal surface; the active item gets a faint Electric Blue fill, a 3px Electric Blue mark, an Electric Blue icon and weight 500. The footer holds the Member, a Light / System / Dark switch and a Sign out icon.
- **Badge (Needs you):** Orange fill, Industrial Blue text.
- **Skeletons** over spinners where the layout is known.

## Theme

Light is the default. A Light / System / Dark switch sits at the bottom of the sidebar (System follows the OS). Dark uses a deep navy base (#0E1A26 page, #142433 cards, #0A1520 sidebar), an Electric Blue grid, light text #E6EBF0, and an Electric Blue primary button with dark navy text.

## Do's and Don'ts

- Do: keep Electric Blue and Orange as signals, never as text on white or large backgrounds.
- Do: maintain WCAG AA (4.5:1 text, 3:1 boundaries) and honor `prefers-reduced-motion`.
- Don't: use emojis as icons, pure black, glows, decorative gradients or heavy shadows.
