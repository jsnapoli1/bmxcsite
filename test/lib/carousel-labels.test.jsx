import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import Carousel from '../../src/components/ui/Carousel.jsx';

/**
 * The carousel's controls are named only by `aria-label`.
 *
 * The arrows render `←`/`→` marked `aria-hidden`, so the aria-label is the
 * whole accessible name — content, not decoration. `<Editable>` cannot wrap
 * an attribute, so Carousel registers with `useEditable` and reads its labels
 * back from the returned props.
 *
 * What matters here is the branch that has no editor: `id` is optional, and
 * without one (or without a provider) the hook must be skipped rather than
 * throwing. `<Editable>` throws outside a `VeditProvider`, and these render
 * with no provider at all — so this file fails loudly if that guard is lost.
 *
 * Static markup rather than a DOM: every test in this repo runs in the
 * Cloudflare Workers pool, which has no jsdom. The attributes are all here.
 */

const slides = [
  <div key="a" className="carousel__slide">One</div>,
  <div key="b" className="carousel__slide">Two</div>,
];

describe('Carousel without an id', () => {
  it('renders outside a VeditProvider rather than throwing', () => {
    expect(() => renderToStaticMarkup(<Carousel label="Gear">{slides}</Carousel>)).not.toThrow();
  });

  it('keeps the labels it was given', () => {
    const html = renderToStaticMarkup(<Carousel label="Gear">{slides}</Carousel>);
    expect(html).toContain('aria-label="Gear"');
    expect(html).toContain('aria-label="Gear slides"');
    expect(html).toContain('aria-label="Previous"');
    expect(html).toContain('aria-label="Next"');
  });

  it('numbers each dot from the slideLabel template', () => {
    const html = renderToStaticMarkup(<Carousel label="Gear">{slides}</Carousel>);
    expect(html).toContain('aria-label="Go to slide 1"');
    expect(html).toContain('aria-label="Go to slide 2"');
    // the template itself must never reach the DOM
    expect(html).not.toContain('{n}');
  });

  it('registers no vedit node, so nothing is addressable without an id', () => {
    const html = renderToStaticMarkup(<Carousel label="Gear">{slides}</Carousel>);
    expect(html).not.toContain('data-vedit-id');
  });
});

describe('Carousel label overrides', () => {
  it('accepts replacements for every control name', () => {
    const html = renderToStaticMarkup(
      <Carousel
        label="Apparel"
        previousLabel="Back"
        nextLabel="Forward"
        slideLabel="Item {n}"
      >
        {slides}
      </Carousel>,
    );
    expect(html).toContain('aria-label="Back"');
    expect(html).toContain('aria-label="Forward"');
    expect(html).toContain('aria-label="Item 1"');
    expect(html).toContain('aria-label="Item 2"');
  });

  it('keeps the arrow glyphs hidden, so the label is the only name', () => {
    const html = renderToStaticMarkup(<Carousel label="Gear">{slides}</Carousel>);
    expect(html).toContain('aria-hidden="true"');
    // If these ever stopped being hidden the aria-label would be redundant
    // rather than load-bearing, which is worth noticing.
    expect(html).toMatch(/aria-hidden="true">←/);
    expect(html).toMatch(/aria-hidden="true">→/);
  });
});
