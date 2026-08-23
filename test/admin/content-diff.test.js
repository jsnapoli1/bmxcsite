import { describe, it, expect } from 'vitest';
import { contentMatchesPublished } from '../../src/admin/lib/content-diff.js';

describe('contentMatchesPublished', () => {
  it('reports no unpublished changes for a staff group with no members, once published', () => {
    // Reproduces the stuck-banner bug: a director saves a group with zero
    // members and publishes it. getPublished omits empty-member groups
    // (see repository.js's nested-status policy), so the raw draft and
    // raw published payloads can never be byte-equal — the banner must not
    // treat that omission as a real difference.
    const draft = { groups: [{ group: 'Camp Directors', members: [] }] };
    const published = { groups: [] };

    expect(contentMatchesPublished('staff', draft, published)).toBe(true);
  });

  it('reports no unpublished changes for an faq category with no items, once published', () => {
    const draft = { categories: [{ id: 'new', label: 'New category', items: [] }] };
    const published = { categories: [] };

    expect(contentMatchesPublished('faq', draft, published)).toBe(true);
  });

  it('still reports unpublished changes when a populated group differs from published', () => {
    const draft = {
      groups: [{ group: 'Camp Directors', members: [{ name: 'Ken', role: 'Director' }] }],
    };
    const published = { groups: [] };

    expect(contentMatchesPublished('staff', draft, published)).toBe(false);
  });

  it('reports a match when draft and published are genuinely identical', () => {
    const content = {
      groups: [{ group: 'Camp Directors', members: [{ name: 'Ken', role: 'Director' }] }],
    };

    expect(contentMatchesPublished('staff', content, content)).toBe(true);
  });

  it('reports unpublished changes for merch, which has no nested parent/child shape', () => {
    const draft = { items: [{ id: 'hoodie', name: 'Hoodie' }], facts: [] };
    const published = { items: [], facts: [] };

    expect(contentMatchesPublished('merch', draft, published)).toBe(false);
  });

  it('reports a match for merch when both sides are identical', () => {
    const content = { items: [{ id: 'hoodie', name: 'Hoodie' }], facts: [] };

    expect(contentMatchesPublished('merch', content, content)).toBe(true);
  });

  it('reports unpublished changes for campinfo, which has no nested parent/child shape', () => {
    const draft = { fields: { phone: { value: '555-1234', label: 'Phone' } } };
    const published = { fields: {} };

    expect(contentMatchesPublished('campinfo', draft, published)).toBe(false);
  });

  it('returns false when either side is missing', () => {
    expect(contentMatchesPublished('staff', null, { groups: [] })).toBe(false);
    expect(contentMatchesPublished('staff', { groups: [] }, null)).toBe(false);
  });

  it('does not mutate the draft it is given', () => {
    const draft = { groups: [{ group: 'Camp Directors', members: [] }] };
    const snapshot = JSON.stringify(draft);

    contentMatchesPublished('staff', draft, { groups: [] });

    expect(JSON.stringify(draft)).toBe(snapshot);
  });
});
