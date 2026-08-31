import { describe, it, expect } from 'vitest';
import { AREAS as SERVER_AREAS } from '../../worker/auth/permissions.js';
import { AREAS as PANEL_AREAS, EMPTY_PERMISSIONS } from '../../src/admin/lib/permission-areas.js';
import { EDITABLE_PAGES, VEDIT_SESSION_KEY, VEDIT_OPEN_KEY } from '../../src/lib/visual-editor-pages.js';

/**
 * The admin panel keeps its own area list, because labels are a UI concern
 * the worker has no business naming. The cost of that duplication is drift,
 * and it has bitten once: `design` was added to the worker, the API and the
 * database, but not to the panel — leaving the permission grantable over
 * HTTP and invisible to the person meant to grant it.
 */
describe('admin permission toggles', () => {
  it('offers a toggle for every area the server can grant', () => {
    const offered = PANEL_AREAS.map((area) => area.key).sort();
    expect(offered).toEqual([...SERVER_AREAS].sort());
  });

  it('offers nothing the server would refuse', () => {
    // The reverse direction: a toggle for an area `hasPermission` doesn't
    // know about writes a column that grants nothing, which reads to an
    // admin as a permission that silently does not work.
    for (const area of PANEL_AREAS) {
      expect(SERVER_AREAS).toContain(area.key);
    }
  });

  it('gives every area a non-empty label', () => {
    for (const area of PANEL_AREAS) {
      expect(area.label?.trim()).toBeTruthy();
    }
  });

  it('starts a new user with every permission off', () => {
    expect(Object.keys(EMPTY_PERMISSIONS).sort()).toEqual([...SERVER_AREAS].sort());
    expect(Object.values(EMPTY_PERMISSIONS).every((v) => v === false)).toBe(true);
  });
});

describe('the Site design entry point', () => {
  it('is gated by an area the server actually knows', () => {
    // AdminApp gates the tab on `design`; if that stopped being a real
    // permission the tab would show for nobody and the editor would have no
    // entry point at all.
    expect(SERVER_AREAS).toContain('design');
    expect(PANEL_AREAS.map((a) => a.key)).toContain('design');
  });

  it('offers a page for every route the editor can open', () => {
    // The Design page renders EDITABLE_PAGES directly rather than restating
    // the routes, so this mostly pins that it stays non-empty and shaped as
    // the list the editor consumes.
    expect(EDITABLE_PAGES.length).toBeGreaterThan(0);
    for (const page of EDITABLE_PAGES) {
      expect(page.path.startsWith('/')).toBe(true);
      expect(page.label?.trim()).toBeTruthy();
    }
  });

  it('keeps the two handoff flags distinct', () => {
    // One key doing both jobs is the bug this split exists to prevent:
    // consuming it would revoke the button after a single page.
    expect(VEDIT_SESSION_KEY).not.toBe(VEDIT_OPEN_KEY);
  });
});
