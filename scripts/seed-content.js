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

import { readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stripJsonComments } from './jsonc.js';
import { saveArea, publishArea } from '../worker/content/repository.js';
import { STAFF_GROUPS } from '../src/data/staff.js';
import { FAQ_CATEGORIES } from '../src/data/faq.js';
import { MERCH_ITEMS, MERCH_FACTS } from '../src/data/merch.js';
import { CAMP } from '../src/data/camp.js';

const SEED_EDITOR_EMAIL = 'seed@bmxc.camp';

/**
 * The seven tables that hold editor-authored content (not
 * `content_version`, which is metadata the migration itself seeds to `1`
 * for every area — a fresh, genuinely empty content database still has
 * four rows there, and counting it would make the guard below fire on a
 * database that has never been seeded at all).
 */
export const CONTENT_TABLES = Object.freeze([
  'staff_groups',
  'staff_members',
  'faq_categories',
  'faq_items',
  'merch_items',
  'merch_facts',
  'camp_fields',
]);

/**
 * Decides whether a `--remote` seed run should be aborted before it writes
 * anything, given row counts already read from the live database and
 * whether `--force` was passed.
 *
 * Pure and synchronous on purpose: `saveArea` is documented as an
 * unconditional delete-then-insert (see repository.js), which is correct
 * for a seed run, but the seed script is the one place that contract meets
 * an unattended write to production. Once camp directors start editing
 * content through the panel, a second `--remote` run — out of habit, or to
 * pick up a `src/data` correction — would otherwise silently wipe their
 * edits with no warning.
 *
 * `counts` is `{ [tableName]: number }` for every table in
 * `CONTENT_TABLES`; content is considered present if the sum across all
 * seven tables is nonzero, not just any single one — content can be
 * partially present (e.g. campinfo published but staff still empty), and
 * checking only one table would let a partial-content database through
 * unguarded.
 *
 * Kept as a standalone pure function (no D1 binding, no process access) so
 * it's testable without a live database — `test/worker/seed.test.js`
 * exercises this directly. The wrangler-proxy path that actually reads
 * counts and calls this is not covered by tests; see the seed-guard tests'
 * own comment for why.
 */
export function evaluateRemoteGuard({ counts, force }) {
  const totalRows = CONTENT_TABLES.reduce((sum, table) => sum + (counts[table] ?? 0), 0);

  if (totalRows === 0) {
    return { abort: false };
  }

  if (force === true) {
    return { abort: false };
  }

  const nonEmpty = CONTENT_TABLES
    .filter((table) => (counts[table] ?? 0) > 0)
    .map((table) => `${table} (${counts[table]} row${counts[table] === 1 ? '' : 's'})`);

  const message = [
    'ABORTED: --remote seed would overwrite existing content.',
    '',
    `Found ${totalRows} existing row${totalRows === 1 ? '' : 's'} across content tables:`,
    ...nonEmpty.map((line) => `  - ${line}`),
    '',
    'saveArea() replaces an area\'s rows unconditionally (delete-then-insert),',
    'so running this seed now would destroy whatever is in those tables —',
    'including any edits made through the admin panel.',
    '',
    'If you are certain you want to overwrite this content, re-run with --force.',
  ].join('\n');

  return { abort: true, message };
}

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

/**
 * Reads a `{ [tableName]: number }` row count for every table in
 * `CONTENT_TABLES`, in parallel. Used only by the `--remote` guard — local
 * seeding never calls this (see main(), and CONTENT_TABLES's own comment
 * on why `content_version` is excluded from the count).
 */
async function countContentRows(db) {
  const rows = await Promise.all(
    CONTENT_TABLES.map(async (table) => {
      const row = await db.prepare(`SELECT COUNT(*) as n FROM ${table}`).first();
      return [table, row.n];
    }),
  );
  return Object.fromEntries(rows);
}

/**
 * Saves and immediately publishes every area, in one D1 binding session.
 *
 * Each area's save+publish is its own pair of `db.batch()` calls (see
 * repository.js), not one transaction spanning all four areas. If this
 * loop fails partway through — network blip, a bad payload for one area —
 * the areas already processed stay seeded and published, and the rest are
 * left exactly as they were before this ran (empty, on a fresh migration).
 * That is understood and accepted here, not overlooked: re-running this
 * script is idempotent (each area's save does a delete-then-insert), so
 * the fix for a partial run is just running it again. Areas left empty by
 * a partial failure degrade to the bundled fallback content on the public
 * site (see src/hooks/useContent.js's isEmpty gate) rather than a blank
 * page, so a partial seed is recoverable, not a production incident.
 */
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
  const force = args.includes('--force');

  if (isLocal === isRemote) {
    console.error('Usage: node scripts/seed-content.js --local | --remote [--force]');
    console.error('Pass exactly one of --local or --remote.');
    process.exitCode = 1;
    return;
  }

  const { getPlatformProxy } = await import('wrangler');

  // `remoteBindings: true` alone is NOT enough to reach production. Each
  // binding must ALSO carry `remote: true`, or the proxy
  // silently falls back to local state — the same `env.DB` name, quietly
  // pointing somewhere else. That silence is the hazard: an earlier version
  // of this script counted rows in the LOCAL database while reporting on
  // production, and its safety guard refused a seed that should have run.
  //
  // The flag is written into a temporary config rather than wrangler.jsonc
  // because a permanent `remote: true` would point `wrangler dev` at
  // the live database too. Nobody should be one stray command away from
  // editing production while developing.
  let configPath;
  let tempConfigPath;
  if (isRemote) {
    const baseConfig = JSON.parse(
      stripJsonComments(await readFile('wrangler.jsonc', 'utf8')),
    );
    baseConfig.d1_databases = (baseConfig.d1_databases ?? []).map((binding) => ({
      ...binding,
      remote: true,
    }));
    tempConfigPath = join(tmpdir(), `bmxc-seed-remote-${process.pid}.json`);
    await writeFile(tempConfigPath, JSON.stringify(baseConfig, null, 2));
    configPath = tempConfigPath;
  }

  const proxy = await getPlatformProxy({
    remoteBindings: isRemote,
    ...(configPath ? { configPath } : {}),
  });

  try {
    // The clobber guard applies to --remote only. Local seeding is a
    // development convenience that must stay frictionless — re-running it
    // against a throwaway local database is expected, routine, and has no
    // director's real edits to protect.
    if (isRemote) {
      const counts = await countContentRows(proxy.env.DB);
      const decision = evaluateRemoteGuard({ counts, force });
      if (decision.abort) {
        console.error(decision.message);
        process.exitCode = 1;
        return;
      }
    }

    console.log(`Seeding ${isRemote ? 'REMOTE (production)' : 'local'} D1...`);
    await seed(proxy.env.DB);
    console.log('Seed complete.');
  } finally {
    await proxy.dispose();
    if (tempConfigPath) {
      await rm(tempConfigPath, { force: true });
    }
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
