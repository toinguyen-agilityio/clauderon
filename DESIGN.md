---
version: "alpha"
name: "Estilo de IA Ética"
description: "Ethical AI visual system (designmd.app/library/estilo-de-ia-etica) applied to the Clauderon app: clean, airy, trustworthy; flat surfaces, Roboto, ethical blue, restrained shadows and subtle ease-out motion."
colors:
  primary: "#1A73E8"
  secondary: "#FFFFFF"
  tertiary: "#F8F9FA"
  neutral: "#3C4043"
  surface: "#34A853"
  accent: "#FBBC05"
typography:
  h1:
    fontFamily: Roboto
    fontSize: 2.5rem
    fontWeight: 700
  body-md:
    fontFamily: Roboto
    fontSize: 1rem
    fontWeight: 400
rounded:
  sm: 8px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    rounded: "{rounded.sm}"
    padding: 12px
---

## Overview

Clean and trustworthy: legibility over mystique, generous whitespace, honest color, structure that invites scrutiny. Grounded in human-scale design decisions rather than a techno-utopian look.

- Density: 3/10 — Airy
- Variance: 3/10 — Restrained
- Motion: 4/10 — Subtle
- **Light/Dark:** Light by default. The sidebar toggle still offers Dark (charcoal `#202124`, never pure black) and System.

## Colors

- **Azul Ético** (#1A73E8) — primary, links, focus states, active navigation
- **Branco** (#FFFFFF) — card and panel surface
- **Cinza Claro** (#F8F9FA) — page background
- **Cinza Escuro** (#3C4043) — body text on light
- **Verde** (#34A853 family) — success states
- **Amarelo** (#FBBC05 family) — warning states
- **Vermelho** (#EA4335 family) — errors, destructive actions

## Typography

- Display / body / labels: Roboto (700 / 400 / 500)
- Monospace: JetBrains Mono — for anything that comes from git, GitHub or a Pod
- Scale: Hero clamp(2.5rem, 5vw, 4rem) · H1 2.25rem · H2 1.5rem · Body 1rem/1.6 · Small 0.875rem

## Layout

- CSS Grid; max-width 1280px; base unit 8px.
- Collapse multi-column layouts below 768px, no horizontal overflow.

## Elevation & Depth

- Flat color only, no decorative gradients. Shadows no heavier than `0 2px 8px rgba(0,0,0,0.08)`.
- Ease-out, 200–300ms. Entry: fade + translate-Y (16px → 0) over 420ms, staggered 80ms.
- Hover: subtle color shift + shadow adjustment over 200ms. Only transform and opacity animate for entrances; honor `prefers-reduced-motion`.

## Shapes

Radius 8px (controls, cards); 16px and 24px for larger surfaces (modals).

## Components

- **Primary button:** 8px radius, primary fill, weight 600, hover darkens, active presses 1px. Text is white in the app (the template's `#3C4043` is too low-contrast on blue).
- **Cards:** 8px radius, surface fill, 1px border, soft shadow.
- **Inputs:** label above, 1px border, 2px accent focus ring, error text in semantic red.
- **Navigation:** active item gets an accent indicator and weight 500.
- **Empty states:** icon + descriptive text + action.

## Do's and Don'ts

- No emojis in UI — use the icon system.
- No decorative gradients, no pure black, no heavy shadows.
- No oversaturated accents (saturation cap 80%).
- No AI copywriting clichés ("Elevate", "Seamless", "Unleash", "Next-Gen").
