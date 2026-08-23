import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import { buildSeedPayload } from '../../scripts/seed-content.js';
import { saveArea, publishArea } from '../../worker/content/repository.js';
import { STAFF_GROUPS } from '../../src/data/staff.js';
import { FAQ_CATEGORIES } from '../../src/data/faq.js';
import { MERCH_ITEMS, MERCH_FACTS } from '../../src/data/merch.js';

/**
 * Task 6 cut public pages over from the bundled `src/data/*.js` modules to
 * `GET /api/content/:area` (via `useContent`). This is the regression guard
 * for that migration: it seeds and publishes each area exactly the way
 * `scripts/seed-content.js` does, then calls the SAME public endpoint the
 * pages call in the browser, and asserts the JSON is exactly what the pages
 * would have rendered from the hardcoded module — same fields, same order,
 * same values.
 *
 * `test/worker/seed-lossless.test.js` already proves the repository round
 * trip is lossless at the data-access layer. This test proves the same
 * thing one layer up: through the actual HTTP route the browser fetches,
 * in the exact shape each page destructures (`group`/`members`,
 * `id`/`label`/`items[{q,a}]`, `items`/`facts`) — the shapes CLAUDE.md notes
 * were wrong once (`group.title` vs `group.group`, `item.question` vs
 * `item.q`) with no test catching it until the page rendered blank.
 */

async function getPublicContent(area) {
  const payload = buildSeedPayload()[area];
  await saveArea(env.DB, area, payload, 'seed@bmxc.camp');
  await publishArea(env.DB, area, 'seed@bmxc.camp');

  const response = await app.fetch(
    new Request(`https://bmxc.camp/api/content/${area}`),
    env,
  );
  expect(response.status).toBe(200);
  return response.json();
}

describe('content parity: API response matches the bundled module', () => {
  it('staff: src/pages/Staff.jsx reads content.groups[].group and .members[]', async () => {
    const { groups } = await getPublicContent('staff');

    // Same shape the page destructures: `group.group`, not `group.title`.
    expect(groups.map((g) => g.group)).toEqual(STAFF_GROUPS.map((g) => g.group));
    expect(groups).toHaveLength(STAFF_GROUPS.length);

    STAFF_GROUPS.forEach((sourceGroup, i) => {
      expect(groups[i].members.map((m) => m.name)).toEqual(
        sourceGroup.members.map((m) => m.name),
      );
      sourceGroup.members.forEach((sourceMember, j) => {
        const member = groups[i].members[j];
        expect(member.name).toBe(sourceMember.name);
        expect(member.role).toBe(sourceMember.role);
        expect(member.bio).toBe(sourceMember.bio);
        expect(member.since ?? null).toBe(sourceMember.since ?? null);
      });
    });
  });

  it('faq: src/pages/Faq.jsx reads content.categories[].id/.label/.items[{q,a}]', async () => {
    const { categories } = await getPublicContent('faq');

    // Same shape the page destructures: `category.id`, not `category.slug`;
    // `item.q`/`item.a`, not `item.question`/`item.answer`. Faq.jsx also
    // selects by `.find(entry => entry.id === activeCategory)` and gates the
    // mail-address block on `category.id === 'mail'` — a missing/renamed id
    // breaks navigation entirely, so id parity is asserted explicitly.
    expect(categories.map((c) => c.id)).toEqual(FAQ_CATEGORIES.map((c) => c.id));
    expect(categories.map((c) => c.label)).toEqual(FAQ_CATEGORIES.map((c) => c.label));
    expect(categories.map((c) => c.id)).toContain('mail');

    FAQ_CATEGORIES.forEach((sourceCategory, i) => {
      const got = categories[i].items.map((item) => [item.q, item.a]);
      const want = sourceCategory.items.map((item) => [item.q, item.a]);
      expect(got).toEqual(want);
    });
  });

  it('merch: src/pages/Merch.jsx reads content.items[] and content.facts[]', async () => {
    const { items, facts } = await getPublicContent('merch');

    expect(items.map((i) => i.id)).toEqual(MERCH_ITEMS.map((i) => i.id));
    MERCH_ITEMS.forEach((sourceItem, i) => {
      const item = items[i];
      expect(item.name).toBe(sourceItem.name);
      expect(item.fit).toBe(sourceItem.fit);
      expect(item.material).toBe(sourceItem.material);
      expect(item.color).toBe(sourceItem.color);
      expect(item.note).toBe(sourceItem.note);
      expect(item.image).toBe(sourceItem.image);
      expect(item.tag).toBe(sourceItem.tag);
      // hero is strictly coerced through the repository — only a literal
      // `true` on the source item should come back as `true` here.
      expect(item.hero).toBe(sourceItem.hero === true);
    });

    expect(facts.map((f) => f.title)).toEqual(MERCH_FACTS.map((f) => f.title));
    facts.forEach((fact, i) => {
      expect(fact.body).toBe(MERCH_FACTS[i].body);
      expect(fact.tag).toBe(MERCH_FACTS[i].tag);
    });
  });

  it('an area outside Task 6\'s scope (campinfo) still returns valid JSON via the public route', async () => {
    // campinfo is seeded/published by buildSeedPayload() too, but the public
    // pages migrated in Task 6 (staff, faq, merch) only ever request their
    // own area — this just confirms the public route itself never 500s for
    // a known area, which would otherwise force every page onto its
    // fallback simultaneously.
    const body = await getPublicContent('campinfo');
    expect(body).toHaveProperty('fields');
  });
});
