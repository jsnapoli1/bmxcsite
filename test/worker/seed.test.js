import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { saveArea, publishArea, getPublished } from '../../worker/content/repository.js';
import { buildSeedPayload, evaluateRemoteGuard, CONTENT_TABLES } from '../../scripts/seed-content.js';
import { STAFF_GROUPS } from '../../src/data/staff.js';
import { FAQ_CATEGORIES } from '../../src/data/faq.js';
import { MERCH_ITEMS, MERCH_FACTS } from '../../src/data/merch.js';
import { CAMP } from '../../src/data/camp.js';

/**
 * This suite is the migration's correctness gate: it proves the seeded
 * database reproduces the current hardcoded site *exactly*, not
 * approximately. Every assertion compares against the source module
 * directly (not a fixture copied from it), so the test breaks the moment
 * either side drifts.
 */

describe('seed content — staff', () => {
  it('preserves every group title, in order', async () => {
    await saveArea(env.DB, 'staff', buildSeedPayload().staff, 'seed');
    await publishArea(env.DB, 'staff', 'seed');
    const { groups } = await getPublished(env.DB, 'staff');

    expect(groups.map((g) => g.group)).toEqual(STAFF_GROUPS.map((g) => g.group));
  });

  it('preserves every member name, in order, within each group', async () => {
    await saveArea(env.DB, 'staff', buildSeedPayload().staff, 'seed');
    await publishArea(env.DB, 'staff', 'seed');
    const { groups } = await getPublished(env.DB, 'staff');

    groups.forEach((group, i) => {
      expect(group.members.map((m) => m.name))
        .toEqual(STAFF_GROUPS[i].members.map((m) => m.name));
    });
  });

  it('preserves every member bio byte-identically', async () => {
    await saveArea(env.DB, 'staff', buildSeedPayload().staff, 'seed');
    await publishArea(env.DB, 'staff', 'seed');
    const { groups } = await getPublished(env.DB, 'staff');

    groups.forEach((group, i) => {
      group.members.forEach((member, j) => {
        expect(member.bio).toBe(STAFF_GROUPS[i].members[j].bio);
      });
    });
  });

  it('preserves role and since for every member', async () => {
    await saveArea(env.DB, 'staff', buildSeedPayload().staff, 'seed');
    await publishArea(env.DB, 'staff', 'seed');
    const { groups } = await getPublished(env.DB, 'staff');

    groups.forEach((group, i) => {
      group.members.forEach((member, j) => {
        const source = STAFF_GROUPS[i].members[j];
        expect(member.role).toBe(source.role);
        expect(member.since ?? null).toBe(source.since ?? null);
      });
    });
  });
});

describe('seed content — faq', () => {
  it('preserves every question and answer verbatim, across all categories', async () => {
    // Em-dashes inside FAQ answers are the camp's own words (CLAUDE.md).
    // This asserts byte equality so no migration step "cleans up" their voice.
    await saveArea(env.DB, 'faq', buildSeedPayload().faq, 'seed');
    await publishArea(env.DB, 'faq', 'seed');
    const { categories } = await getPublished(env.DB, 'faq');

    const seededQuestions = categories.flatMap((c) => c.items.map((i) => i.q));
    const sourceQuestions = FAQ_CATEGORIES.flatMap((c) => c.items.map((i) => i.q));
    expect(seededQuestions).toEqual(sourceQuestions);

    const seededAnswers = categories.flatMap((c) => c.items.map((i) => i.a));
    const sourceAnswers = FAQ_CATEGORIES.flatMap((c) => c.items.map((i) => i.a));
    expect(seededAnswers).toEqual(sourceAnswers);
  });

  it('preserves every category id and label, in order', async () => {
    await saveArea(env.DB, 'faq', buildSeedPayload().faq, 'seed');
    await publishArea(env.DB, 'faq', 'seed');
    const { categories } = await getPublished(env.DB, 'faq');

    expect(categories.map((c) => c.id)).toEqual(FAQ_CATEGORIES.map((c) => c.id));
    expect(categories.map((c) => c.label)).toEqual(FAQ_CATEGORIES.map((c) => c.label));
  });

  it('preserves item count per category', async () => {
    await saveArea(env.DB, 'faq', buildSeedPayload().faq, 'seed');
    await publishArea(env.DB, 'faq', 'seed');
    const { categories } = await getPublished(env.DB, 'faq');

    categories.forEach((category, i) => {
      expect(category.items.length).toBe(FAQ_CATEGORIES[i].items.length);
    });
  });
});

describe('seed content — merch', () => {
  it('preserves every item field, in order', async () => {
    await saveArea(env.DB, 'merch', buildSeedPayload().merch, 'seed');
    await publishArea(env.DB, 'merch', 'seed');
    const { items } = await getPublished(env.DB, 'merch');

    expect(items).toHaveLength(MERCH_ITEMS.length);

    items.forEach((item, i) => {
      const source = MERCH_ITEMS[i];
      expect(item.id).toBe(source.id);
      expect(item.name).toBe(source.name);
      expect(item.fit).toBe(source.fit ?? null);
      expect(item.material).toBe(source.material ?? null);
      expect(item.color).toBe(source.color ?? null);
      expect(item.note).toBe(source.note ?? null);
      expect(item.image).toBe(source.image ?? null);
      expect(item.tag).toBe(source.tag ?? null);
      // Strict boolean coercion: hero must be a real boolean, and must
      // match the source's truthiness exactly (source omits `hero` for
      // non-hero items, so it's `undefined` there, not `false`).
      expect(item.hero).toBe(source.hero === true);
      expect(typeof item.hero).toBe('boolean');
    });
  });

  it('preserves every fact field, in order', async () => {
    await saveArea(env.DB, 'merch', buildSeedPayload().merch, 'seed');
    await publishArea(env.DB, 'merch', 'seed');
    const { facts } = await getPublished(env.DB, 'merch');

    expect(facts).toHaveLength(MERCH_FACTS.length);

    facts.forEach((fact, i) => {
      const source = MERCH_FACTS[i];
      expect(fact.title).toBe(source.title);
      expect(fact.body).toBe(source.body);
      expect(fact.tag).toBe(source.tag ?? null);
    });
  });

  it('the hero hoodie is the only item flagged hero: true', async () => {
    await saveArea(env.DB, 'merch', buildSeedPayload().merch, 'seed');
    await publishArea(env.DB, 'merch', 'seed');
    const { items } = await getPublished(env.DB, 'merch');

    const heroItems = items.filter((item) => item.hero === true);
    const sourceHeroItems = MERCH_ITEMS.filter((item) => item.hero === true);
    expect(heroItems.map((i) => i.id)).toEqual(sourceHeroItems.map((i) => i.id));
  });
});

describe('seed content — campinfo', () => {
  it('includes all five in-scope fields with the values currently in camp.js', async () => {
    await saveArea(env.DB, 'campinfo', buildSeedPayload().campinfo, 'seed');
    await publishArea(env.DB, 'campinfo', 'seed');
    const { fields } = await getPublished(env.DB, 'campinfo');

    const keys = Object.keys(fields);
    expect(keys).toHaveLength(5);

    const values = Object.fromEntries(keys.map((key) => [key, fields[key].value]));
    const expected = Object.values(values);

    expect(expected).toContain(String(CAMP.session.year));
    expect(expected).toContain(CAMP.session.start);
    expect(expected).toContain(CAMP.session.end);
    expect(expected).toContain(CAMP.contact.email);
    expect(expected).toContain(CAMP.contact.phone);
  });

  it('every field has a non-empty, human-readable label', async () => {
    await saveArea(env.DB, 'campinfo', buildSeedPayload().campinfo, 'seed');
    await publishArea(env.DB, 'campinfo', 'seed');
    const { fields } = await getPublished(env.DB, 'campinfo');

    for (const key of Object.keys(fields)) {
      const { label } = fields[key];
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
      // A label that's just the raw key ("session_start") is not
      // human-readable — it should read like copy a camp director would
      // recognize in an editor UI.
      expect(label).not.toBe(key);
    }
  });

  it('the contact email reflects whatever is currently in camp.js, not a hardcoded value', async () => {
    await saveArea(env.DB, 'campinfo', buildSeedPayload().campinfo, 'seed');
    await publishArea(env.DB, 'campinfo', 'seed');
    const { fields } = await getPublished(env.DB, 'campinfo');

    const emailField = Object.values(fields).find((f) => f.value === CAMP.contact.email);
    expect(emailField).toBeDefined();
  });
});

describe('buildSeedPayload — shape', () => {
  it('returns exactly the four areas the repository knows about', () => {
    const payload = buildSeedPayload();
    expect(Object.keys(payload).sort()).toEqual(['campinfo', 'faq', 'merch', 'staff']);
  });

  it('is deterministic across calls (no shared mutable state)', () => {
    const first = buildSeedPayload();
    const second = buildSeedPayload();
    expect(first).toEqual(second);
  });
});

describe('evaluateRemoteGuard — the --remote clobber guard', () => {
  /**
   * `evaluateRemoteGuard` is the pure "should this abort?" decision the
   * guard is built on, extracted specifically so it's testable without a
   * live database — see its own doc comment in scripts/seed-content.js.
   * The wrangler-proxy path that reads real row counts and calls this
   * (main()'s `if (isRemote) { ... }` block) is not covered here: it
   * requires a live D1 binding reachable only via getPlatformProxy, which
   * is out of reach for a unit test and out of scope for this suite.
   */

  function zeroCounts() {
    return Object.fromEntries(CONTENT_TABLES.map((table) => [table, 0]));
  }

  it('does not abort when every content table is empty', () => {
    const decision = evaluateRemoteGuard({ counts: zeroCounts(), force: false });
    expect(decision.abort).toBe(false);
  });

  it('aborts when any single content table has rows, without --force', () => {
    const counts = { ...zeroCounts(), staff_groups: 3 };
    const decision = evaluateRemoteGuard({ counts, force: false });
    expect(decision.abort).toBe(true);
  });

  it('aborts on partial content — one populated table among otherwise-empty ones', () => {
    // Content can be partially present (e.g. campinfo published, staff
    // still empty). The guard must not treat "not every table" as "safe".
    const counts = { ...zeroCounts(), camp_fields: 5 };
    const decision = evaluateRemoteGuard({ counts, force: false });
    expect(decision.abort).toBe(true);
  });

  it('aborts when rows are spread across multiple tables', () => {
    const counts = {
      ...zeroCounts(), staff_groups: 4, staff_members: 10, faq_categories: 7,
    };
    const decision = evaluateRemoteGuard({ counts, force: false });
    expect(decision.abort).toBe(true);
  });

  it('does not abort when rows exist but --force is passed', () => {
    const counts = { ...zeroCounts(), merch_items: 3, merch_facts: 4 };
    const decision = evaluateRemoteGuard({ counts, force: true });
    expect(decision.abort).toBe(false);
  });

  it('--force has no effect when there is nothing to protect', () => {
    const decision = evaluateRemoteGuard({ counts: zeroCounts(), force: true });
    expect(decision.abort).toBe(false);
  });

  it('the abort message names every non-empty table and its row count', () => {
    const counts = { ...zeroCounts(), staff_groups: 4, faq_items: 44 };
    const { message } = evaluateRemoteGuard({ counts, force: false });

    expect(message).toContain('staff_groups (4 rows)');
    expect(message).toContain('faq_items (44 rows)');
    // Empty tables should not be listed as if they were part of the problem.
    expect(message).not.toContain('merch_items');
  });

  it('the abort message uses singular "row" for a count of exactly one', () => {
    const counts = { ...zeroCounts(), camp_fields: 1 };
    const { message } = evaluateRemoteGuard({ counts, force: false });

    expect(message).toContain('camp_fields (1 row)');
    expect(message).not.toContain('camp_fields (1 rows)');
  });

  it('the abort message states what would be destroyed', () => {
    const counts = { ...zeroCounts(), staff_groups: 1 };
    const { message } = evaluateRemoteGuard({ counts, force: false });

    expect(message).toMatch(/overwrite|destroy/i);
  });

  it('the abort message names --force as the way to override', () => {
    const counts = { ...zeroCounts(), staff_groups: 1 };
    const { message } = evaluateRemoteGuard({ counts, force: false });

    expect(message).toContain('--force');
  });

  it('a successful (non-abort) decision carries no message', () => {
    const decision = evaluateRemoteGuard({ counts: zeroCounts(), force: false });
    expect(decision.message).toBeUndefined();
  });
});
