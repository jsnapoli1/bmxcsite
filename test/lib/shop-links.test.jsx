import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { VeditProvider } from 'vedit';
import Navbar from '../../src/components/layout/Navbar.jsx';
import Footer from '../../src/components/layout/Footer.jsx';
import { EDITABLE_PAGES } from '../../src/lib/visual-editor-pages.js';
// As text: these run in the Workers pool, where node:fs is unavailable.
import appSource from '../../src/App.jsx?raw';
import navbarSource from '../../src/components/layout/Navbar.jsx?raw';
import footerSource from '../../src/components/layout/Footer.jsx?raw';

/**
 * /merch, /store and /shop are Worker redirects to shop.bmxc.camp, and the
 * only way anyone reaches them is by following a link.
 *
 * That makes the *element* load-bearing. A `<NavLink to="/merch">` is handled
 * by React Router, which never lets the browser make a request — so the
 * redirect fires for a bookmark and not for the nav, which is how most people
 * get there. Removing the route alone does not fix it either: React Router
 * then matches nothing and renders the 404 page instead.
 *
 * Both of those were observed in a browser during this change. Neither shows
 * up in a status-code check, because curl does not run React.
 */

function render(node) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <VeditProvider documentKey="test" enabled={false} auto={false}>
        {node}
      </VeditProvider>
    </MemoryRouter>,
  );
}

/**
 * Asserted against the source, not the markup.
 *
 * Both a `<NavLink to="/merch">` and an `<a href="/merch">` render the same
 * `<a href="/merch">` on the server — the difference is the click handler
 * React attaches in the browser, which static markup cannot show. The first
 * version of this file checked the rendered HTML and passed happily with the
 * bug reintroduced, so it checked nothing.
 */
describe('links to the store', () => {
  it('marks the merch entry external in both link lists', () => {
    for (const [name, source] of [['Navbar', navbarSource], ['Footer', footerSource]]) {
      const entry = source.match(/\{[^{}]*'\/merch'[^{}]*\}/)?.[0];
      expect(entry, `${name} has no /merch entry`).toBeTruthy();
      expect(entry, `${name}'s /merch link must be external:true, or React Router `
        + 'swallows the click and the Worker redirect never runs')
        .toContain('external: true');
    }
  });

  it('renders that entry as a plain anchor', () => {
    expect(render(<Navbar />)).toMatch(/<a[^>]+href="\/merch"/);
    expect(render(<Footer />)).toMatch(/<a[^>]+href="\/merch"/);
  });

  it('leaves every other destination routing client-side', () => {
    // The escape hatch should be narrow: only paths the Worker redirects.
    const externals = [...navbarSource.matchAll(/\{[^{}]*external: true[^{}]*\}/g)]
      .map((m) => m[0].match(/'([^']+)'/)?.[1]);
    expect(externals).toEqual(['/merch']);
  });
});

describe('the merch page is gone', () => {
  it('serves no /merch route, so nothing shadows the redirect', () => {
    const routes = [...appSource.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]);
    expect(routes).not.toContain('/merch');
  });

  it('does not offer /merch in the visual editor', () => {
    // Offering a page the site no longer serves would open an artboard on
    // the 404 page.
    expect(EDITABLE_PAGES.map((page) => page.path)).not.toContain('/merch');
  });
});
