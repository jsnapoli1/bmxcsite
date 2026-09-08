/**
 * The packing list is edited in the browser, so its ids are load-bearing.
 *
 * vedit keys an override on `camp.packing.item.<id>`. Renaming an item's
 * text is fine and keeps its override; changing an `id` orphans that
 * override, and reusing one moves a different item's edit onto this row —
 * the failure the ids exist to prevent. These tests make either mistake
 * fail loudly rather than silently reattaching someone's edit.
 */
import { describe, it, expect } from 'vitest';
import { PACKING_LIST } from '../../src/data/packing.js';

const items = PACKING_LIST.flatMap((group) => group.items);

describe('packing list ids', () => {
  it('gives every category an id', () => {
    for (const group of PACKING_LIST) {
      expect(group.id, `category "${group.category}" has no id`).toBeTruthy();
    }
  });

  it('gives every item an id and text', () => {
    for (const item of items) {
      expect(item.id, `item ${JSON.stringify(item)} has no id`).toBeTruthy();
      expect(item.text, `item ${item.id} has no text`).toBeTruthy();
    }
  });

  it('never repeats an item id', () => {
    const ids = items.map((item) => item.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates, 'duplicate ids move one item\'s override onto another').toEqual([]);
  });

  it('never repeats a category id', () => {
    const ids = PACKING_LIST.map((group) => group.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps ids url-safe, so they read plainly in the editor', () => {
    for (const item of items) {
      expect(item.id, `${item.id} is not a plain slug`).toMatch(/^[a-z0-9-]+$/);
    }
    for (const group of PACKING_LIST) {
      expect(group.id, `${group.id} is not a plain slug`).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
