# Design tokens

`tokens.css` is the single source for colour, type, spacing, and motion.
Never hardcode a palette or type value in a component stylesheet.

## Direction: Field Guide

Set like a team handbook — reference-dense, plainly typeset, structure from
rules and weight rather than elevation.

- **Display:** Source Serif 4. Signals institution and age (est. 1969).
- **Surfaces:** warm paper `#faf8f4` / `#f0ece4`, ink `#1c1a17`.
- **Palette:** sampled from the camp's logo art — navy `#183060` (62% of the
  mark), gold `#c09018`, green `#306030`. Do not substitute an invented scheme.
- **Shadows:** all `none`. Deliberate, not an oversight.
- **Radii:** 2-6px. Ruled, not rounded.

## Banned

Uppercase headings, gradient-filled text, decorative gradients, animated
stripes, hover lifts, pill buttons. All were stripped once as template tells;
reintroducing any of them undoes the direction.

The one remaining gradient is the hero scrim — functional, for text contrast.

## Motion

Compositor-only (`transform` / `opacity`). Reveals fire via IntersectionObserver
with `rootMargin: 0px 0px 12% 0px` — a **positive** bottom margin so elements
start fading just before entry. A negative value makes motion lag the scroll.
Staggers are capped (`Math.min(index, 5)`) so list length never drives delay.

`prefers-reduced-motion` is handled globally in `tokens.css`.
