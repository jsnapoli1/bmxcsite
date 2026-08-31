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

  it('places everything into a slot or a container on that page', () => {
    // A placement whose parentId names neither renders nowhere and is
    // reachable from nothing — invisible, and only findable in the JSON.
    // Cards nest inside a container component (the pillars grid), so a
    // parent may be the page slot or another placement on the same page.
    for (const [path, doc] of Object.entries(buildAllDocuments(AT))) {
      const valid = new Set([PAGE_SLOTS[path], ...doc.inserted.map((n) => n.id)]);
      for (const node of doc.inserted) {
        expect(valid.has(node.parentId), `${path} node ${node.id}`).toBe(true);
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

  it('numbers each set of siblings consecutively from zero', () => {
    // vedit sorts siblings by `index`. A gap or a duplicate reorders them
    // silently — fine in the JSON, wrong in the browser. Indices are per
    // parent, so cards inside a container restart at zero.
    for (const [path, doc] of Object.entries(buildAllDocuments(AT))) {
      const byParent = {};
      for (const node of doc.inserted) {
        (byParent[node.parentId] ??= []).push(node.index);
      }
      for (const [parent, indices] of Object.entries(byParent)) {
        expect(indices.sort((a, b) => a - b), `${path} under ${parent}`)
          .toEqual(indices.map((_, i) => i));
      }

      // The page's own top-level order still matches the declared layout.
      const top = doc.inserted
        .filter((n) => n.parentId === PAGE_SLOTS[path])
        .sort((a, b) => a.index - b.index)
        .map((n) => n.component);
      expect(top, path).toEqual(PAGE_LAYOUTS[path]);
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
      const mastheadNodes = doc.inserted
        .filter((n) => n.component === 'PageMasthead')
        .map((n) => doc.nodes[n.id]);
      expect(mastheadNodes.length, path).toBe(hasMasthead ? 1 : 0);
      if (hasMasthead) {
        expect(Object.keys(mastheadNodes[0].props), path).toEqual(['page']);
        expect(mastheadNodes[0].props.page, path).toBe(path);
      }
    }
  });

  it('seeds no rendered copy except the pillar cards, which own theirs', () => {
    // Sections read their copy from src/data, so a seeded sentence would
    // drift from the code and nobody would notice. Pillar cards are the
    // deliberate exception: their text lives in the document precisely so a
    // fifth card can be added without a deploy.
    const cardIds = new Set(
      Object.values(buildAllDocuments(AT))
        .flatMap((doc) => doc.inserted)
        .filter((n) => n.component === 'PillarCard')
        .map((n) => n.id),
    );

    for (const [path, doc] of Object.entries(buildAllDocuments(AT))) {
      for (const [id, node] of Object.entries(doc.nodes)) {
        if (cardIds.has(id)) continue;
        for (const [key, value] of Object.entries(node.props ?? {})) {
          expect(typeof value === 'string' && value.includes(' '), `${path}.${key}`)
            .toBe(false);
        }
      }
    }
  });

  it('gives every pillar card its copy', () => {
    const doc = buildPageDocument('/', AT);
    const cards = doc.inserted.filter((n) => n.component === 'PillarCard');
    expect(cards.length).toBeGreaterThanOrEqual(4);
    for (const card of cards) {
      const props = doc.nodes[card.id]?.props ?? {};
      expect(props.title, `${card.id} needs a title`).toBeTruthy();
      expect(props.body, `${card.id} needs a body`).toBeTruthy();
    }
  });

  it('nests the cards inside the pillars grid, not the page slot', () => {
    const doc = buildPageDocument('/', AT);
    const grid = doc.inserted.find((n) => n.component === 'HomePillars');
    for (const card of doc.inserted.filter((n) => n.component === 'PillarCard')) {
      expect(card.parentId, card.id).toBe(grid.id);
    }
  });
});
