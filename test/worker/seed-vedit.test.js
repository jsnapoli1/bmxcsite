import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  buildPageDocument,
  buildAllDocuments,
  PAGE_LAYOUTS,
  PAGE_SLOTS,
} from '../../scripts/seed-vedit-pages.js';
import { EDITABLE_PAGES } from '../../src/lib/visual-editor-pages.js';
import { components } from '../../src/lib/vedit-components.js';
import { d1Store } from '../../worker/vedit/store.js';

const AT = '2026-01-01T00:00:00.000Z';

describe('seeded page documents', () => {
  it('places only components the registry knows', () => {
    // A name the registry lacks renders vedit's "not registered" placeholder
    // instead of the section — the page would come up visibly broken.
    const known = new Set(Object.keys(components));
    for (const [path, layout] of Object.entries(PAGE_LAYOUTS)) {
      for (const name of layout) {
        expect(known, `${path} places unknown component ${name}`).toContain(name);
      }
    }
  });

  it('places everything into a slot that page actually renders', () => {
    // A placement whose parentId names no slot renders nowhere and is
    // reachable from nothing — invisible, and only findable in the JSON.
    for (const [path, doc] of Object.entries(buildAllDocuments(AT))) {
      const slot = PAGE_SLOTS[path];
      for (const node of doc.inserted) {
        expect(node.parentId, `${path} node ${node.id}`).toBe(slot);
      }
    }
  });

  it('covers every composed route, and only composed routes', () => {
    // The CMS-backed pages (merch, staff, faq, blog) are deliberately not
    // composed: their content comes from D1 via /admin, and a slot there
    // would be a third place to change the same page.
    const seeded = Object.keys(PAGE_LAYOUTS).sort();
    expect(seeded).toEqual(
      ['/', '/camp', '/contact', '/playlists', '/registration', '/videos'],
    );

    const editable = EDITABLE_PAGES.map((page) => page.path);
    for (const path of seeded) {
      expect(editable, `${path} is seeded but not offered in the editor`)
        .toContain(path);
    }
  });

  it('numbers placements consecutively from zero, in render order', () => {
    // vedit sorts siblings by `index`. A gap or a duplicate reorders the page
    // silently, which is exactly the kind of thing that looks fine in the
    // JSON and wrong in the browser.
    for (const [path, doc] of Object.entries(buildAllDocuments(AT))) {
      const indices = doc.inserted.map((node) => node.index);
      expect(indices, path).toEqual(doc.inserted.map((_, i) => i));

      const order = doc.inserted.map((node) => node.component);
      expect(order, path).toEqual(PAGE_LAYOUTS[path]);
    }
  });

  it('is reproducible — same input, byte-identical output', () => {
    // Node ids are derived rather than random precisely so a re-run is a
    // no-op. vedit's own newInsertedId randomises, which is right for a
    // person placing things and wrong for a migration.
    const a = JSON.stringify(buildPageDocument('/', AT));
    const b = JSON.stringify(buildPageDocument('/', AT));
    expect(a).toBe(b);
  });

  it('gives every node a unique id within its page', () => {
    for (const [path, doc] of Object.entries(buildAllDocuments(AT))) {
      const ids = doc.inserted.map((node) => node.id);
      expect(new Set(ids).size, `${path} has duplicate node ids`).toBe(ids.length);
    }
  });

  it('round-trips through the store the editor and site both read', () => {
    // Building a document the store cannot store would only surface at
    // migration time, against production.
    const store = d1Store(env.DB, 'seed-test');
    return (async () => {
      const doc = buildPageDocument('/camp', AT);
      await store.write(doc, 'published');
      const read = await store.read('/camp', 'published');
      expect(read.inserted.map((n) => n.component)).toEqual(PAGE_LAYOUTS['/camp']);
      expect(read.key).toBe('/camp');
    })();
  });

  it('tells the masthead which page it is on, and nothing more', () => {
    // The seed must not freeze rendered copy: several leads interpolate live
    // data (session dates, venue, directors), and a frozen string goes stale
    // the day the session moves. Only `page` is stored.
    for (const [path, doc] of Object.entries(buildAllDocuments(AT))) {
      const hasMasthead = PAGE_LAYOUTS[path].includes('PageMasthead');
      const propNodes = Object.values(doc.nodes).filter((n) => n.props);
      expect(propNodes.length, path).toBe(hasMasthead ? 1 : 0);
      if (hasMasthead) {
        expect(Object.keys(propNodes[0].props), path).toEqual(['page']);
        expect(propNodes[0].props.page, path).toBe(path);
      }
    }
  });

  it('seeds no rendered copy at all', () => {
    // A guard on the rule above: nothing in a seeded document should be a
    // sentence. If it is, it will drift from src/data and nobody will notice.
    for (const [path, doc] of Object.entries(buildAllDocuments(AT))) {
      for (const node of Object.values(doc.nodes)) {
        for (const [key, value] of Object.entries(node.props ?? {})) {
          expect(typeof value === 'string' && value.includes(' '), `${path}.${key}`)
            .toBe(false);
        }
      }
    }
  });
});
