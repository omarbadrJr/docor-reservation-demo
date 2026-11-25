---
version: alpha
name: حجز دكتور — عيادات البحيرة
description: A mobile-first booking counter for patients in Beheira who need a local doctor without an account; it should feel like a printed appointment slip on a clinic noticeboard.
colors:
  ground: "#F1F5F6"
  surface: "#FFFFFF"
  primary: "#9A4B00"
  ink: "#102C34"
  muted: "#4A6269"
  line: "#C7D3D6"
  signal: "#9A4B00"
typography:
  display:
    fontFamily: Tajawal
    fontSize: 3rem
    fontWeight: 800
    letterSpacing: "-0.02em"
  body:
    fontFamily: Cairo
    fontSize: 1rem
    lineHeight: 1.75
rounded:
  sm: 6px
  md: 10px
spacing:
  sm: 0.5rem
  md: 1rem
  lg: 2rem
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.ground}"
    rounded: "{rounded.sm}"
    padding: 0.875rem 1.25rem
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: 0.875rem 1.25rem
  body-copy:
    textColor: "{colors.muted}"
  paper-edge:
    backgroundColor: "{colors.line}"
---

## Overview

This is a reservation counter for patients with limited technical experience: they need to choose a specialty, see a doctor, and leave with a reference and QR code. The look comes from the objects already in that world — a clinic signboard and the paper appointment slip a patient carries to the counter — not from a generic SaaS dashboard.

The signboard supplies the deep ink header. The slip supplies the content panel: flat white paper, hard hairline borders, printed rows, and a dashed tear line. The saffron-ink stamp has one job: the primary action and any live booking status. Cairo carries body copy; Tajawal is reserved for display.

## Colors

- **Ground (#F1F5F6):** cool paper stock, not warm cream. It is the dominant surface and the text color on the stamp.
- **Surface (#FFFFFF):** the slip itself; used only for cards, inputs, and dialogs that are meant to read as paper.
- **Ink (#102C34):** signboard ink for headings and the header background; 13.36:1 on ground.
- **Muted (#4A6269):** secondary copy; 5.90:1 on ground and 6.48:1 on paper.
- **Signal (#9A4B00):** the stamp — primary action and live status only. 5.66:1 against ground, 6.21:1 with paper text on it.
- **Line (#C7D3D6):** the hairline that makes paper and signboard edges legible without a colored glow.

## Typography

Cairo is the working face for every label, field, and row at 16px with 1.75 leading. Tajawal is the display face for page and section headings; it may go loud once, on the page heading. No uppercase tracking, no mono chrome, no accented single word in a headline.

## Layout

A signboard header spans the top. Content returns to a single `max-w-6xl` measure, but sections do not all share one template: the hero is left-aligned text beside a printed slip, and the follow-up band is a full-width signboard strip. The slip — a bordered paper panel with a dashed divider — is the one structural idea every patient page reuses when showing a booking or a doctor.

## Elevation & Depth

Surfaces stay flat. Depth comes from hairline borders, the dashed perforation, and the slip's offset rule — never colored glow shadows or frosted glass. Only sticky navigation and dialog backdrops may layer over scrolling content, and they use solid color, not blur.

## Shapes

Buttons use a 6px square-ish radius. Paper panels use a 10px radius at most. Dialogs and cards stay flat and square enough to read as printed material. No `rounded-2xl` + soft shadow on every surface.

## Components

- **Patient nav:** ink signboard background, white wordmark, a saffron square for the stethoscope mark, and plain text links. Reuse verbatim on specialties, doctor, and booking pages.
- **Dashboard shell:** the same ink background on desktop and mobile chrome, with saffron reserved for the active role action.
- **Buttons:** primary is saffron with paper text; secondary is neutral paper with ink text. No arrow welded to the label.
- **Slip:** white paper, hairline ink border, dashed divider, printed label/value rows. This is the signature detail for appointment and doctor cards.
- **States:** plain text and icon, no tinted icon chip. Success uses `Stamp`, not `CheckCircle2`.

## Do's and Don'ts

- Do reuse the nav, footer, buttons, slip, and tokens above on every page, unchanged.
- Do add a token here before a page uses it. Never invent a one-off inside a page.
- Don't change: Cairo and Tajawal, RTL, and the canonical Egyptian Arabic labels in `AGENTS.md`.
- Don't use: cream + terracotta, near-black + acid green, emerald as a safe accent, purple gradients, icon-in-a-tinted-square, backdrop blur, colored glow shadows, decorative 01/02/03, one accented headline word, or middle-dot metadata strings.
