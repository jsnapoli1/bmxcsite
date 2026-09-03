import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Busy, Failure, Empty } from '../../src/admin/components/States.jsx';

/**
 * These render to static markup rather than into a DOM.
 *
 * Every test in this repo runs in the Cloudflare Workers pool
 * (vitest.config.js), which has no jsdom and cannot load one. What is worth
 * pinning here is the markup contract — the ARIA attributes that decide
 * whether a screen reader announces a failure, and the empty-message case
 * that decides whether it announces one that has not happened. Static
 * markup carries all of that, and needs no DOM.
 */

describe('Busy', () => {
  it('marks itself busy for assistive technology', () => {
    const html = renderToStaticMarkup(<Busy />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('Loading…');
  });

  it('takes a custom label', () => {
    expect(renderToStaticMarkup(<Busy label="Uploading…" />)).toContain('Uploading…');
  });
});

describe('Failure', () => {
  it('announces itself as an alert', () => {
    const html = renderToStaticMarkup(<Failure message="Nope" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('Nope');
  });

  it('renders nothing when there is no message', () => {
    // Pages hold error state as null most of the time. Rendering an empty
    // alert box then would announce a failure that has not happened.
    expect(renderToStaticMarkup(<Failure message={null} />)).toBe('');
    expect(renderToStaticMarkup(<Failure message="" />)).toBe('');
  });
});

describe('Empty', () => {
  it('renders its children', () => {
    const html = renderToStaticMarkup(<Empty>Nothing here yet.</Empty>);
    expect(html).toContain('Nothing here yet.');
    expect(html).toContain('admin-notice--empty');
  });
});
