import { describe, it, expect } from 'vitest';
import { isEmpty } from '../../src/hooks/useContent.js';

/**
 * A migrated-but-unseeded database answers every content endpoint with one
 * of these exact shapes: a 200 whose top-level collections are all empty.
 * useContent must treat every one of these as "no content yet" and keep
 * the bundled fallback rather than replacing it with emptiness.
 */
describe('isEmpty', () => {
  it('returns true for an empty staff payload', () => {
    expect(isEmpty({ groups: [] })).toBe(true);
  });

  it('returns true for an empty faq payload', () => {
    expect(isEmpty({ categories: [] })).toBe(true);
  });

  it('returns true for an empty merch payload', () => {
    expect(isEmpty({ items: [], facts: [] })).toBe(true);
  });

  it('returns true for an empty campinfo payload', () => {
    expect(isEmpty({ fields: {} })).toBe(true);
  });

  it('returns true for an empty object', () => {
    expect(isEmpty({})).toBe(true);
  });

  it('returns true for null', () => {
    expect(isEmpty(null)).toBe(true);
  });

  it('returns true for undefined', () => {
    expect(isEmpty(undefined)).toBe(true);
  });

  it('returns false for a staff payload with one group', () => {
    expect(isEmpty({ groups: [{ group: 'Camp Directors', members: [] }] })).toBe(false);
  });

  it('returns false for a faq payload with one category', () => {
    expect(isEmpty({
      categories: [{ id: 'registration', label: 'Registration', items: [] }],
    })).toBe(false);
  });

  it('returns false for a merch payload with a single item and no facts', () => {
    expect(isEmpty({ items: [{ id: 'hoodie', name: 'Hoodie' }], facts: [] })).toBe(false);
  });

  it('returns false for a merch payload with a single fact and no items', () => {
    expect(isEmpty({ items: [], facts: [{ title: 'Fact', body: 'Body' }] })).toBe(false);
  });

  it('returns false for a campinfo payload with a single field', () => {
    expect(isEmpty({ fields: { phone: { value: '555-1234', label: 'Phone' } } })).toBe(false);
  });

  it('does not over-trigger on a fully populated payload', () => {
    expect(isEmpty({
      categories: [
        { id: 'registration', label: 'Registration', items: [{ q: 'Q?', a: 'A.' }] },
      ],
    })).toBe(false);
  });
});
