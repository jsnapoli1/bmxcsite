/**
 * Every list a person edits in the browser is keyed on an explicit id.
 *
 * vedit keys an override on that id, so it is load-bearing: renaming an
 * item's text is fine and keeps its override, but changing an `id` orphans
 * it, and reusing one moves a different item's edit onto this row. These
 * lists were all unwrapped originally *because* their only handle was the
 * string itself — an id built from the text reattaches the moment someone
 * rewords one, which is exactly what editing them is for.
 *
 * Prices are deliberately absent. pricing.js and Stripe charge those
 * figures, so a retypable number would be a second, disagreeing answer.
 */
import { describe, it, expect } from 'vitest';
import { PACKING_LIST } from '../../src/data/packing.js';
import { PAYMENT_NOTES, FINE_PRINT } from '../../src/data/registration.js';
import { MERCH_CAVEATS } from '../../src/data/merch.js';
import { STAFF_CREDENTIALS } from '../../src/data/staff.js';
import { FAQ_CATEGORIES, MAIL_ADDRESSES } from '../../src/data/faq.js';
import { mintQuestionId, withQuestionIds } from '../../src/lib/faq-ids.js';

/** Flat `{ id, text }` lists: same shape, same invariants. */
const TEXT_LISTS = {
  PACKING_LIST: PACKING_LIST.flatMap((group) => group.items),
  PAYMENT_NOTES,
  FINE_PRINT,
  MERCH_CAVEATS,
  STAFF_CREDENTIALS,
};

describe.each(Object.entries(TEXT_LISTS))('%s', (name, items) => {
  it('gives every entry an id and text', () => {
    for (const item of items) {
      expect(item.id, `an entry of ${name} has no id`).toBeTruthy();
      expect(item.text, `${name} entry ${item.id} has no text`).toBeTruthy();
    }
  });

  it('never repeats an id', () => {
    const ids = items.map((item) => item.id);
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(duplicates, "duplicate ids move one entry's override onto another").toEqual([]);
  });

  it('keeps ids readable slugs', () => {
    for (const item of items) {
      expect(item.id, `${item.id} is not a plain slug`).toMatch(/^[a-z0-9-]+$/);
    }
  });
});

describe('PACKING_LIST categories', () => {
  it('gives every category a unique slug id', () => {
    const ids = PACKING_LIST.map((group) => group.id);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('FAQ question ids', () => {
  const items = FAQ_CATEGORIES.flatMap((category) => category.items);

  it('gives every question an id, and never repeats one', () => {
    for (const item of items) expect(item.id, `"${item.q}" has no id`).toBeTruthy();
    const ids = items.map((item) => item.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('keeps question ids readable slugs', () => {
    for (const item of items) expect(item.id).toMatch(/^[a-z0-9-]+$/);
  });

  it('mints a fresh id rather than colliding with one already taken', () => {
    const taken = new Set(['registration-open']);
    const id = mintQuestionId('When does registration open?', taken);
    expect(id).not.toBe('registration-open');
    expect(taken.has(id)).toBe(false);
  });

  it('fills in ids for documents written before questions had them', () => {
    const legacy = [
      { id: 'c1', items: [{ q: 'How long is camp?', a: 'A week.' }, { q: 'Cost?', a: '$555.' }] },
    ];
    const filled = withQuestionIds(legacy);
    const ids = filled[0].items.map((item) => item.id);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    // text is untouched
    expect(filled[0].items[0].q).toBe('How long is camp?');
  });

  it('leaves a fully-migrated document alone', () => {
    expect(withQuestionIds(FAQ_CATEGORIES)).toBe(FAQ_CATEGORIES);
  });

  it('does not reuse an id already present elsewhere in the document', () => {
    const mixed = [
      { id: 'c1', items: [{ id: 'cost', q: 'Cost?', a: 'x' }, { q: 'Cost?', a: 'y' }] },
    ];
    const ids = withQuestionIds(mixed)[0].items.map((item) => item.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('MAIL_ADDRESSES', () => {
  const lines = MAIL_ADDRESSES.flatMap((address) => address.lines);

  it('gives every address and every line an id', () => {
    for (const address of MAIL_ADDRESSES) {
      expect(address.id, `"${address.label}" has no id`).toBeTruthy();
      for (const line of address.lines) {
        expect(line.id, `a line of "${address.label}" has no id`).toBeTruthy();
        expect(line.text).toBeTruthy();
      }
    }
  });

  it('never repeats a line id', () => {
    const ids = lines.map((line) => line.id);
    expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);
  });

  it('is the case that proves text cannot be the key', () => {
    // Two lines are identical across both carriers, so an id derived from
    // the text would not even be unique, let alone survive a rewording.
    const texts = lines.map((line) => line.text);
    expect(new Set(texts).size).toBeLessThan(texts.length);
    // ...while the ids are.
    expect(new Set(lines.map((l) => l.id)).size).toBe(lines.length);
  });
});
