import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  getPublished, getAll, saveArea, publishArea, getVersion, UnknownAreaError,
} from '../../worker/content/repository.js';

// Payload key is `group` (the legacy page shape src/pages/Staff.jsx
// reads), not `title`.
const STAFF = {
  groups: [
    { group: 'Camp Directors', members: [
      { name: 'Ken Crawford', role: 'Camp Director', bio: 'Bio.' },
      { name: 'Sarah Schnitter', role: 'Camp Director', bio: 'Bio.' },
    ] },
    { group: 'Veteran Coaches', members: [
      { name: 'Someone Else', role: 'Coach', bio: 'Bio.' },
    ] },
  ],
};

// Payload keys are `id`/`q`/`a` (the legacy page shape src/pages/Faq.jsx
// reads), not `slug`/`question`/`answer`.
const FAQ = {
  categories: [
    { id: 'registration', label: 'Registration & Payment', items: [
      { q: 'When does registration open?', a: 'January 1st at 12:01am.' },
      { q: 'How does the deposit work?', a: 'It guarantees your spot.' },
    ] },
    { id: 'mail', label: 'Mail & Photos', items: [
      { q: 'Is mail-call still a thing?', a: 'Yes, we love getting mail.' },
    ] },
  ],
};

// Realistic shape, matching what src/pages/Merch.jsx actually reads —
// fit/material/color/note/hero, a string slug as `id`, no price fields.
const MERCH = {
  items: [
    {
      id: 'hoodie',
      name: 'BMXC Hoodie',
      fit: 'Unisex',
      material: '100% cotton',
      color: 'Royal Blue',
      note: 'Our most popular item. Sizes go quickly.',
      image: '/merch/hoodie.jpg',
      tag: 'Hoodie',
      hero: true,
    },
    {
      id: 'singlet',
      name: 'BMXC Singlet',
      fit: "Unisex and women's",
      material: '100% polyester wicking knit',
      color: 'TBD for this year',
      note: 'Wicking knit singlet with the BMXC logo on the front.',
      image: '/merch/singlet.jpg',
      tag: 'Singlet',
      hero: false,
    },
  ],
  facts: [
    { title: 'Cash only', body: 'We only accept cash for BMXC merchandise.', tag: 'Payment' },
  ],
};

describe('repository', () => {
  it('rejects an unknown area', async () => {
    await expect(getPublished(env.DB, 'billing'))
      .rejects.toBeInstanceOf(UnknownAreaError);
  });

  it('returns empty published content before anything is published', async () => {
    const content = await getPublished(env.DB, 'staff');
    expect(content.groups).toEqual([]);
  });

  it('saves as draft, so nothing is published yet', async () => {
    await saveArea(env.DB, 'staff', STAFF, 'ken@example.com');
    expect((await getPublished(env.DB, 'staff')).groups).toEqual([]);
    expect((await getAll(env.DB, 'staff')).groups).toHaveLength(2);
  });

  it('publishes and preserves group and member order', async () => {
    await saveArea(env.DB, 'staff', STAFF, 'ken@example.com');
    await publishArea(env.DB, 'staff', 'ken@example.com');

    const { groups } = await getPublished(env.DB, 'staff');
    expect(groups.map((g) => g.group))
      .toEqual(['Camp Directors', 'Veteran Coaches']);
    expect(groups[0].members.map((m) => m.name))
      .toEqual(['Ken Crawford', 'Sarah Schnitter']);
  });

  it('returns the staff shape the live page reads, not the DB column names', async () => {
    await saveArea(env.DB, 'staff', STAFF, 'ken@example.com');
    await publishArea(env.DB, 'staff', 'ken@example.com');

    const { groups } = await getPublished(env.DB, 'staff');
    // src/pages/Staff.jsx reads group.group as both the heading and the
    // React key — not group.title, which is only the DB column name.
    expect(groups[0]).toEqual({
      group: 'Camp Directors',
      members: [
        { name: 'Ken Crawford', role: 'Camp Director', bio: 'Bio.', since: null },
        { name: 'Sarah Schnitter', role: 'Camp Director', bio: 'Bio.', since: null },
      ],
    });
    expect(groups[0].title).toBeUndefined();
  });

  it('returns the FAQ shape the live page reads, not the DB column names', async () => {
    await saveArea(env.DB, 'faq', FAQ, 'ken@example.com');
    await publishArea(env.DB, 'faq', 'ken@example.com');

    const { categories } = await getPublished(env.DB, 'faq');
    // src/pages/Faq.jsx selects by category.id and gates the mailing
    // block on category.id === 'mail', and reads item.q / item.a — not
    // category.slug or item.question / item.answer, the DB column names.
    expect(categories[0]).toEqual({
      id: 'registration',
      label: 'Registration & Payment',
      items: [
        { q: 'When does registration open?', a: 'January 1st at 12:01am.' },
        { q: 'How does the deposit work?', a: 'It guarantees your spot.' },
      ],
    });
    expect(categories.map((c) => c.id)).toContain('mail');
    expect(categories[0].slug).toBeUndefined();
    expect(categories[0].items[0].question).toBeUndefined();
  });

  it('bumps the version on publish', async () => {
    // First publish ever for this area creates the content_version row
    // (test isolation wipes it — see test/setup.js), so it starts at 1
    // rather than bumping from an existing seed.
    await saveArea(env.DB, 'staff', STAFF, 'ken@example.com');
    const first = await publishArea(env.DB, 'staff', 'ken@example.com');
    expect(first).toBe(1);

    const before = await getVersion(env.DB, 'staff');
    const after = await publishArea(env.DB, 'staff', 'ken@example.com');
    expect(after).toBe(before + 1);
  });

  it('replaces rather than appends on a second save', async () => {
    await saveArea(env.DB, 'staff', STAFF, 'ken@example.com');
    await saveArea(env.DB, 'staff', { groups: [
      { group: 'Only Group', members: [{ name: 'Solo', role: 'Coach', bio: '' }] },
    ] }, 'ken@example.com');

    const { groups } = await getAll(env.DB, 'staff');
    expect(groups).toHaveLength(1);
    expect(groups[0].group).toBe('Only Group');
  });

  it('records who edited', async () => {
    await saveArea(env.DB, 'staff', STAFF, 'sarah@example.com');
    const row = await env.DB.prepare(
      'SELECT updated_by FROM staff_groups LIMIT 1',
    ).first();
    expect(row.updated_by).toBe('sarah@example.com');
  });

  it('saves and publishes merch items with the fields the page reads', async () => {
    await saveArea(env.DB, 'merch', MERCH, 'ken@example.com');
    await publishArea(env.DB, 'merch', 'ken@example.com');

    const { items, facts } = await getPublished(env.DB, 'merch');
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      id: 'hoodie',
      name: 'BMXC Hoodie',
      fit: 'Unisex',
      material: '100% cotton',
      color: 'Royal Blue',
      note: 'Our most popular item. Sizes go quickly.',
      image: '/merch/hoodie.jpg',
      tag: 'Hoodie',
      hero: true,
    });
    expect(facts).toHaveLength(1);
    expect(facts[0].title).toBe('Cash only');
  });

  it('round-trips hero as a strict boolean, not a truthy value', async () => {
    await saveArea(env.DB, 'merch', MERCH, 'ken@example.com');
    await publishArea(env.DB, 'merch', 'ken@example.com');

    const { items } = await getPublished(env.DB, 'merch');
    const hoodie = items.find((item) => item.id === 'hoodie');
    const singlet = items.find((item) => item.id === 'singlet');

    expect(hoodie.hero).toBe(true);
    expect(singlet.hero).toBe(false);

    // The stored column is an INTEGER 0/1, never a JS boolean — assert the
    // DB representation directly so a regression to truthy coercion (e.g.
    // storing NULL and reading it as "truthy" via `!!`) would be caught.
    const row = await env.DB.prepare(
      'SELECT hero FROM merch_items WHERE slug = ?',
    ).bind('singlet').first();
    expect(row.hero).toBe(0);
  });

  it('omits a published staff group whose members are all draft, but getAll still sees it', async () => {
    await saveArea(env.DB, 'staff', STAFF, 'ken@example.com');
    await publishArea(env.DB, 'staff', 'ken@example.com');

    // Directly revert one group's members to draft, bypassing saveArea/
    // publishArea, to simulate the inconsistent state those functions
    // otherwise prevent — the scenario getPublished must still handle.
    await env.DB.prepare(
      "UPDATE staff_members SET status = 'draft' WHERE group_id = ("
      + "SELECT id FROM staff_groups WHERE title = 'Veteran Coaches')",
    ).run();

    const published = await getPublished(env.DB, 'staff');
    expect(published.groups.map((g) => g.group)).toEqual(['Camp Directors']);

    const all = await getAll(env.DB, 'staff');
    expect(all.groups.map((g) => g.group))
      .toEqual(['Camp Directors', 'Veteran Coaches']);
  });

  it('omits a published FAQ category whose items are all draft, but getAll still sees it', async () => {
    await saveArea(env.DB, 'faq', FAQ, 'ken@example.com');
    await publishArea(env.DB, 'faq', 'ken@example.com');

    await env.DB.prepare(
      "UPDATE faq_items SET status = 'draft' WHERE category_id = ("
      + "SELECT id FROM faq_categories WHERE slug = 'mail')",
    ).run();

    const published = await getPublished(env.DB, 'faq');
    expect(published.categories.map((c) => c.id)).toEqual(['registration']);

    const all = await getAll(env.DB, 'faq');
    expect(all.categories.map((c) => c.id)).toEqual(['registration', 'mail']);
  });
});
