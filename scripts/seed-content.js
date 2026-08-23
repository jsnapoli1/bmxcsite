#!/usr/bin/env node
/**
 * Seeds the D1 content tables from the hardcoded `src/data/*.js` modules
 * that the public pages currently read directly.
 *
 * This is the migration's correctness gate: `buildSeedPayload()` maps each
 * module's export shape onto the repository's payload shape (Task 2's
 * `saveArea`/`publishArea`), and `test/worker/seed.test.js` proves that
 * round trip is lossless — every string byte-identical, order preserved,
 * booleans strictly coerced. Read those tests before changing this file;
 * they are the actual spec.
 *
 * Run directly with Node (not through the Worker runtime): `getPlatformProxy`
 * gives this script a real `env.DB` D1 binding, resolved from
 * `wrangler.jsonc`, so it can call the exact same `saveArea`/`publishArea`
 * functions the HTTP API and its tests use — no parallel SQL to keep in
 * sync.
 *
 *   node scripts/seed-content.js --local    seeds the local D1 (migrate first: `npm run migrate:local`)
 *   node scripts/seed-content.js --remote   seeds the live production D1 (migrate first: `npm run migrate:remote`)
 *
 * `wrangler` (and therefore `getPlatformProxy`) is imported dynamically
 * inside `main()`, not at module top level. `test/worker/seed.test.js`
 * imports this module for `buildSeedPayload()` alone, and it runs inside
 * `@cloudflare/vitest-plugin`'s Miniflare Worker pool — `wrangler`'s
 * Node-only internals (child processes, etc.) crash that pool if pulled in
 * at import time. A static top-level import did exactly that during
 * development; deferring it to `main()` keeps the pure payload builder
 * import-safe from a Worker test environment while the CLI path (which
 * only ever runs under plain Node) is unaffected.
 */

import { saveArea, publishArea } from '../worker/content/repository.js';
import { STAFF_GROUPS } from '../src/data/staff.js';
import { FAQ_CATEGORIES } from '../src/data/faq.js';
import { MERCH_ITEMS, MERCH_FACTS } from '../src/data/merch.js';
import { CAMP } from '../src/data/camp.js';

const SEED_EDITOR_EMAIL = 'seed@bmxc.camp';

/**
 * Maps `STAFF_GROUPS` (src/data/staff.js) onto the `saveArea('staff', ...)`
 * payload shape. The repository's payload key is `group` (not `title` —
 * see repository.js's own comment on why: it matches what
 * src/pages/Staff.jsx reads), so no rename happens here; only the
 * `members[]` fields pass through unchanged, verbatim, in source order.
 */
function buildStaffPayload() {
  return {
    groups: STAFF_GROUPS.map((group) => ({
      group: group.group,
      members: group.members.map((member) => ({
        name: member.name,
        role: member.role,
        bio: member.bio,
        since: member.since,
      })),
    })),
  };
}

/**
 * Maps `FAQ_CATEGORIES` (src/data/faq.js) onto the `saveArea('faq', ...)`
 * payload shape. Key renames: `.q` -> `.q` and `.a` -> `.a` are unchanged
 * (the repository's own payload shape already uses `q`/`a` — see
 * repository.js's readFaq/saveFaqStatements comments); `.id`/`.label`
 * pass through unchanged too. No trimming, no normalising — the camp's
 * own em-dashes and phrasing are copied verbatim.
 */
function buildFaqPayload() {
  return {
    categories: FAQ_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      items: category.items.map((item) => ({
        q: item.q,
        a: item.a,
      })),
    })),
  };
}

/**
 * Maps `MERCH_ITEMS`/`MERCH_FACTS` (src/data/merch.js) onto the
 * `saveArea('merch', ...)` payload shape. `hero` is coerced with strict
 * `=== true` — a source item that omits `hero` entirely (every item but
 * the hoodie) becomes the real boolean `false`, never `undefined` or a
 * truthy non-boolean.
 */
function buildMerchPayload() {
  return {
    items: MERCH_ITEMS.map((item) => ({
      id: item.id,
      name: item.name,
      fit: item.fit,
      material: item.material,
      color: item.color,
      note: item.note,
      image: item.image,
      tag: item.tag,
      hero: item.hero === true,
    })),
    facts: MERCH_FACTS.map((fact) => ({
      title: fact.title,
      body: fact.body,
      tag: fact.tag,
    })),
  };
}

/**
 * Maps the five in-scope `CAMP` fields (src/data/camp.js) onto the
 * `saveArea('campinfo', ...)` payload shape: `{ fields: { <key>: { value,
 * label } } }`. Everything else on `CAMP` (venue, social, mailing, name,
 * tagline, ...) deliberately stays in code — see migrations/0002_content.sql's
 * own comment on why only the fields that actually go stale year to year
 * are here.
 *
 * Field keys are stable, snake_case identifiers a migration or future
 * script can rely on. Labels are the human-readable field names a camp
 * director sees in the editor UI, so they're written for that reader:
 *
 *   session_year  "Session year"           — CAMP.session.year (coerced to
 *                                             a string: validateCampInfo
 *                                             requires a non-empty string
 *                                             value, and camp_fields.value
 *                                             is a TEXT column)
 *   session_start "Session start date"     — CAMP.session.start
 *   session_end   "Session end date"       — CAMP.session.end
 *   contact_email "Contact email"          — CAMP.contact.email
 *   contact_phone "Contact phone"          — CAMP.contact.phone
 *
 * The contact email is read from CAMP at call time, not hardcoded here —
 * it changed once already (directors@bluemountainxccamp.com ->
 * info@bmxc.camp on main), and this script must reproduce whatever
 * src/data/camp.js currently says, not a value memorized when it was written.
 */
function buildCampInfoPayload() {
  return {
    fields: {
      session_year: { value: String(CAMP.session.year), label: 'Session year' },
      session_start: { value: CAMP.session.start, label: 'Session start date' },
      session_end: { value: CAMP.session.end, label: 'Session end date' },
      contact_email: { value: CAMP.contact.email, label: 'Contact email' },
      contact_phone: { value: CAMP.contact.phone, label: 'Contact phone' },
    },
  };
}

/**
 * Builds the full seed payload: one entry per area in
 * `AREAS_WITH_CONTENT`, each already shaped for `saveArea`. Pure — reads
 * only the imported modules, no I/O, so it's safe to call repeatedly
 * (e.g. once per area) without re-deriving anything.
 */
export function buildSeedPayload() {
  return {
    staff: buildStaffPayload(),
    faq: buildFaqPayload(),
    merch: buildMerchPayload(),
    campinfo: buildCampInfoPayload(),
  };
}

/** Saves and immediately publishes every area, in one D1 binding session. */
async function seed(db) {
  const payload = buildSeedPayload();

  for (const area of /** @type {const} */ (['staff', 'faq', 'merch', 'campinfo'])) {
    await saveArea(db, area, payload[area], SEED_EDITOR_EMAIL);
    await publishArea(db, area, SEED_EDITOR_EMAIL);
    console.log(`seeded and published: ${area}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const isRemote = args.includes('--remote');

  if (isLocal === isRemote) {
    console.error('Usage: node scripts/seed-content.js --local | --remote');
    console.error('Pass exactly one of --local or --remote.');
    process.exitCode = 1;
    return;
  }

  const { getPlatformProxy } = await import('wrangler');
  const proxy = await getPlatformProxy({
    // Local D1 state (used by `wrangler dev` and `--local` migrations)
    // unless --remote asks for the live production database instead.
    remoteBindings: isRemote,
  });

  try {
    console.log(`Seeding ${isRemote ? 'REMOTE (production)' : 'local'} D1...`);
    await seed(proxy.env.DB);
    console.log('Seed complete.');
  } finally {
    await proxy.dispose();
  }
}

// Only run when invoked directly (`node scripts/seed-content.js ...`), not
// when imported by tests for `buildSeedPayload`.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
