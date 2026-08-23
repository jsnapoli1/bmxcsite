import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { buildSeedPayload } from '../../scripts/seed-content.js';
import { saveArea, publishArea, getPublished } from '../../worker/content/repository.js';
import { STAFF_GROUPS } from '../../src/data/staff.js';
import { FAQ_CATEGORIES } from '../../src/data/faq.js';
import { MERCH_ITEMS, MERCH_FACTS } from '../../src/data/merch.js';
import { CAMP } from '../../src/data/camp.js';

async function seed(area) {
  await saveArea(env.DB, area, buildSeedPayload()[area], 'seed');
  await publishArea(env.DB, area, 'seed');
  return getPublished(env.DB, area);
}

describe('round trip is lossless', () => {
  it('staff: every group and member, in order, bios byte-identical', async () => {
    const { groups } = await seed('staff');
    expect(groups.map(g => g.group)).toEqual(STAFF_GROUPS.map(g => g.group));
    STAFF_GROUPS.forEach((src, i) => {
      expect(groups[i].members.map(m => m.name)).toEqual(src.members.map(m => m.name));
      src.members.forEach((m, j) => {
        expect(groups[i].members[j].bio).toBe(m.bio);
        expect(groups[i].members[j].role).toBe(m.role);
      });
    });
  });

  it('faq: EVERY question and answer byte-identical, em-dashes intact', async () => {
    const { categories } = await seed('faq');
    expect(categories.map(c => c.id)).toEqual(FAQ_CATEGORIES.map(c => c.id));
    const got = categories.flatMap(c => c.items.map(i => [i.q, i.a]));
    const want = FAQ_CATEGORIES.flatMap(c => c.items.map(i => [i.q, i.a]));
    expect(got).toEqual(want);
    // The camp's own punctuation must survive verbatim.
    const emdashes = want.flat().filter(s => s.includes('—')).length;
    expect(got.flat().filter(s => s.includes('—')).length).toBe(emdashes);
    expect(emdashes).toBeGreaterThan(0);
  });

  it('merch: every field of every item, hero a real boolean', async () => {
    const { items, facts } = await seed('merch');
    expect(items.map(i => i.id)).toEqual(MERCH_ITEMS.map(i => i.id));
    MERCH_ITEMS.forEach((src, i) => {
      for (const k of ['name','fit','material','color','note','image','tag']) {
        expect(items[i][k] ?? null).toBe(src[k] ?? null);
      }
      expect(items[i].hero).toBe(src.hero === true);
    });
    expect(facts.map(f => f.title)).toEqual(MERCH_FACTS.map(f => f.title));
    facts.forEach((f, i) => expect(f.body).toBe(MERCH_FACTS[i].body));
  });

  it('campinfo: carries the CURRENT contact email, not a stale one', async () => {
    const { fields } = await seed('campinfo');
    const values = Object.values(fields).map(f => f.value);
    expect(values).toContain(CAMP.contact.email);
    expect(values).toContain('info@bmxc.camp');
    expect(values).not.toContain('directors@bluemountainxccamp.com');
  });
});
