import { describe, it, expect } from 'vitest';
import { components } from '../../src/lib/vedit-components.js';
import HomeIntro from '../../src/components/sections/HomeIntro.jsx';

/**
 * A page's `<VeditSlot>` children are the fallback: what renders when the
 * document has not loaded. That is not a rare path — the editor's adapter
 * reads through /api/admin/vedit, which answers 403 on localhost, so every
 * local page render takes it.
 *
 * The fallback's promise is that a page whose document fails to load still
 * renders the real page. A section whose copy lives only in the registry's
 * `defaults` breaks that promise: the placement path spreads those defaults
 * in, the fallback does not, and the section renders `undefined` where its
 * heading should be. HomeIntro shipped exactly that way.
 */
describe('slot fallbacks render without a document', () => {
  it('HomeIntro renders its heading copy with no props', () => {
    // The fallback in Home.jsx is a bare `<HomeIntro />`.
    const el = HomeIntro({});
    const heading = findHeading(el);

    expect(heading.eyebrow).toBeTypeOf('string');
    expect(heading.title).toBeTypeOf('string');
  });

  it("HomeIntro's own defaults match the registry's", () => {
    // Two sources for one string drift. If the registry is edited and the
    // component is not, the editor and the fallback disagree about what the
    // page says.
    const heading = findHeading(HomeIntro({}));

    expect(heading.eyebrow).toBe(components.HomeIntro.defaults.eyebrow);
    expect(heading.title).toBe(components.HomeIntro.defaults.title);
  });
});

/** The SectionHeading element inside a rendered HomeIntro. */
function findHeading(node) {
  let found;
  (function walk(n) {
    if (!n || typeof n !== 'object' || found) return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.props?.headingId) { found = n.props; return; }
    if (n.props?.children) walk(n.props.children);
  })(node);
  if (!found) throw new Error('no SectionHeading found in HomeIntro');
  return found;
}
