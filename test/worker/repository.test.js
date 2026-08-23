import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import {
  getPublished, getAll, saveArea, publishArea, getVersion, UnknownAreaError,
} from '../../worker/content/repository.js';

const STAFF = {
  groups: [
    { title: 'Camp Directors', members: [
      { name: 'Ken Crawford', role: 'Camp Director', bio: 'Bio.' },
      { name: 'Sarah Schnitter', role: 'Camp Director', bio: 'Bio.' },
    ] },
    { title: 'Veteran Coaches', members: [
      { name: 'Someone Else', role: 'Coach', bio: 'Bio.' },
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
    expect(groups.map((g) => g.title))
      .toEqual(['Camp Directors', 'Veteran Coaches']);
    expect(groups[0].members.map((m) => m.name))
      .toEqual(['Ken Crawford', 'Sarah Schnitter']);
  });

  it('bumps the version on publish', async () => {
    const before = await getVersion(env.DB, 'staff');
    await saveArea(env.DB, 'staff', STAFF, 'ken@example.com');
    const after = await publishArea(env.DB, 'staff', 'ken@example.com');
    expect(after).toBe(before + 1);
  });

  it('replaces rather than appends on a second save', async () => {
    await saveArea(env.DB, 'staff', STAFF, 'ken@example.com');
    await saveArea(env.DB, 'staff', { groups: [
      { title: 'Only Group', members: [{ name: 'Solo', role: 'Coach', bio: '' }] },
    ] }, 'ken@example.com');

    const { groups } = await getAll(env.DB, 'staff');
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe('Only Group');
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
});
