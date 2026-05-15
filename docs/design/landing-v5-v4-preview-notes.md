# VitaLoop Landing Preview V5 + V4 Notes

## Purpose

This preview is a standalone landing page concept for design review only. It is
not integrated into the VitaLoop app and does not add production components,
runtime dependencies, external assets, analytics, backend behavior, payments, or
notification APIs.

## Design Rationale

The page uses variation #5 as the primary direction: minimal premium layout,
confident typography, clean spacing, product mockup emphasis, a dark contrast
section, and wellness categories near the bottom.

It borrows the lifestyle feel from variation #4 through CSS-only image
placeholders that suggest a warm outdoor moment with a busy person using a
phone. These placeholders are intentionally not real photography and should be
replaced only with properly licensed stock imagery if this direction is
approved.

## Structure

- Header: VitaLoop wordmark, section links, and a primary "Preview app" call to
  action.
- Hero: large "Clarity. Focus. Well-being." headline, supporting product copy,
  two calls to action, a phone-style product mockup, and a warm lifestyle
  placeholder panel.
- Product mockup: a native-feeling card system showing "Good morning",
  "Focus time", "Hydrate", "Move", "Reflect", and a Done action.
- Why VitaLoop: dark contrast section with personalized reminders, smarter
  scheduling, private defaults, and future wrist-based actions.
- How it helps: wellness categories for Hydrate, Move, Focus, Reflect, and
  Breathe.
- Lifestyle section: larger warm lifestyle placeholder with copy about
  routines, quiet hours, and gentle nudges.
- Footer: privacy, terms, support, and copyright placeholder.

## Image Placeholder Direction

The hero and lifestyle panels are CSS-drawn placeholders. They are meant to
communicate the approved stock-image direction only:

- warm outdoor or natural setting
- calm light and premium editorial framing
- busy person checking a phone
- practical wellness context, not medical or fitness positioning

No external images, copied assets, remote URLs, logos, screenshots, or branded
device assets are used.

## Implementation Notes

- The file is standalone HTML with inline CSS.
- There is no JavaScript.
- There are no external fonts or dependencies.
- The preview should not be copied directly into `src/**`; approved sections
  should be translated into the app deliberately after review.
- If implemented later, use real product components and tested routing/state
  instead of this static preview markup.
- Replace CSS placeholders only with licensed assets and documented usage
  rights.

## Accessibility Considerations

- The page uses semantic `header`, `main`, `section`, `nav`, and `footer`
  elements.
- There is one `h1`.
- Section headings follow a simple hierarchy.
- CTA links have visible text and focus styles.
- Lifestyle placeholders use `role="img"` with meaningful accessible text.
- The page uses system fonts and avoids external font loading.
- Smooth scrolling is disabled for users who prefer reduced motion.
- Color choices are designed for strong contrast between text and surfaces.
