#!/usr/bin/env node
/**
 * Seeds the vedit documents for the six composed pages, so each one starts out
 * as the exact page it has always been — but assembled from placed components
 * the editor can reorder, remove and add to.
 *
 * Without this, those pages render their in-code fallback: correct for a
 * visitor, but nothing is movable, because vedit only shows the fallback while
 * the slot is empty (`count === 0 ? children : null`). Seeding is what turns
 * "looks the same" into "is composed".
 *
 * The layouts below mirror the fallback children in each page component.
 * `test/worker/seed-vedit.test.js` asserts they stay in step — a section added
 * to a page but not here would quietly vanish the moment someone edits that
 * page, because the first placement replaces the whole fallback.
 *
 * Follows scripts/seed-content.js: `wrangler` is imported dynamically inside
 * `main()` so the pure payload builder stays import-safe from the Worker test
 * pool, which crashes on wrangler's Node-only internals at import time.
 *
 *   node scripts/seed-vedit-pages.js --local    seeds local D1 (migrate first)
 *   node scripts/seed-vedit-pages.js --remote   seeds production D1
 *
 * Idempotent: re-running replaces each document with the same content. It
 * writes the `published` stage, so seeded pages are live immediately — they
 * are byte-identical to what visitors already see.
 *
 * SAFETY: this overwrites whatever is in those documents. Run it once, at
 * migration time. Running it again after someone has composed a page discards
 * their work — recoverable from the History panel, but a bad afternoon.
 */

/** Every component placed on each page, in render order. */
const PAGE_LAYOUTS = {
  '/': ['Hero', 'HomeIntro', 'HomePillars', 'HomeLocation', 'HomeCta'],
  '/camp': ['PageMasthead', 'CampSchedule', 'CampPacking'],
  '/registration': [
    'PageMasthead',
    'RegistrationPricing',
    'RegistrationBuses',
    'RegistrationDetails',
  ],
  '/contact': ['PageMasthead', 'ContactChannels'],
  '/playlists': ['PageMasthead', 'PlaylistsSection'],
  '/videos': ['PageMasthead', 'VideosSection'],
};

/**
 * The slot each page's components are placed into. Must match the `id` on the
 * `<VeditSlot>` in the page component — a placement whose parentId names no
 * slot renders nowhere and is reachable from nothing.
 */
const PAGE_SLOTS = {
  '/': 'home.page',
  '/camp': 'camp.page',
  '/registration': 'registration.page',
  '/contact': 'contact.page',
  '/playlists': 'playlists.page',
  '/videos': 'videos.page',
};

/**
 * The masthead placement carries which page's copy to use, and nothing else.
 *
 * Deliberately not the rendered strings: several leads interpolate live data
 * (session dates, venue, directors), and freezing them into the document would
 * go stale the day the session moves. PageMasthead reads them from
 * `src/data/*` at render time, exactly as the pages always did.
 */
const MASTHEAD_PAGES = Object.freeze([
  '/camp', '/registration', '/contact', '/playlists', '/videos',
]);

/**
 * The pillar cards on the home page, placed inside the HomePillars grid.
 *
 * Their copy lives here rather than in `src/data/camp.js` because the grid is
 * a container: cards are placed components, so one can be added or removed
 * from the editor. That is the trade — this text no longer appears in a pull
 * request, and a deleted card is recovered through the History panel.
 *
 * These are the four the page has always had, lifted verbatim. Ids match the
 * old PILLARS ids so any override already stored against one still applies.
 */
const PILLAR_CARDS = [
  {
    id: 'training',
    tag: "Training",
    title: "Grouped by ability, not by age",
    body: "We collect your training data right before camp so we have an accurate view of your training and fitness, and we create running groups based on that data. Every group stays together with an assigned coach, and we have road support cars out on the route.",
    wide: true,
  },
  {
    id: 'terrain',
    tag: "Terrain",
    title: "Miles of running terrain",
    body: "We run on a combination of winding dirt roads, grass fields, paved roads, and a long cinder path. There is no track at camp, and we do not do measured intervals.",
  },
  {
    id: 'staff',
    tag: "Staff",
    title: "Experienced staff",
    body: "Our staff includes Hall of Fame high school coaches, current and former Division 1, 2 and 3 college athletes, a registered nurse, and Red Cross certified lifeguards.",
  },
  {
    id: 'community',
    tag: "Community",
    title: "Teams and individuals",
    body: "About half the camp comes as teams of 7 or more, and the other half in smaller groups or on their own. Campers develop friendships that last well beyond high school.",
  },
];

/** vedit's document format version. Kept in step with DOCUMENT_VERSION. */
const DOCUMENT_VERSION = 1;

/**
 * Build the document for one page.
 *
 * Node ids are derived from the page and position rather than random, so
 * re-running produces the identical document and a diff of two seeds is
 * empty. `newInsertedId` in vedit randomises, which is right for a person
 * placing things and wrong for a migration that should be reproducible.
 */
export function buildPageDocument(path, updatedAt) {
  const slot = PAGE_SLOTS[path];
  if (!slot) throw new Error(`No slot registered for ${path}`);

  const layout = PAGE_LAYOUTS[path];
  const nodes = {};
  const inserted = layout.map((component, index) => {
    const id = `${slot}:${index}-${component}`;

    // The masthead needs to know which page it is on; everything else
    // renders its own copy with no props at all.
    if (component === 'PageMasthead') {
      nodes[id] = { props: { page: path } };
    }

    return { id, parentId: slot, kind: 'component', component, index };
  });

  // The pillars grid is a container; its cards are placements inside it.
  const grid = inserted.find((node) => node.component === 'HomePillars');
  if (grid) {
    PILLAR_CARDS.forEach((card, index) => {
      const cardId = `${grid.id}:${card.id}`;
      nodes[cardId] = {
        props: {
          tag: card.tag,
          title: card.title,
          body: card.body,
          ...(card.wide ? { wide: true } : {}),
        },
      };
      inserted.push({
        id: cardId,
        parentId: grid.id,
        kind: 'component',
        component: 'PillarCard',
        index,
      });
    });
  }

  return {
    version: DOCUMENT_VERSION,
    key: path,
    updatedAt,
    nodes,
    inserted,
    tokens: [],
  };
}

/** Every page's document, keyed by path. */
export function buildAllDocuments(updatedAt) {
  return Object.fromEntries(
    Object.keys(PAGE_LAYOUTS).map((path) => [path, buildPageDocument(path, updatedAt)]),
  );
}

export { PAGE_LAYOUTS, PAGE_SLOTS, MASTHEAD_PAGES };

/** SQL escaping for a single-quoted string literal. */
function quote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function main() {
  const remote = process.argv.includes('--remote');
  const local = process.argv.includes('--local');
  if (remote === local) {
    console.error('Pass exactly one of --local or --remote.');
    process.exit(1);
  }

  const updatedAt = new Date().toISOString();
  const documents = buildAllDocuments(updatedAt);

  // Built as one SQL file and handed to `wrangler d1 execute`, rather than
  // written through getPlatformProxy's DB binding.
  //
  // getPlatformProxy with `experimental.remoteBindings` silently wrote to the
  // LOCAL database while reporting success — the seed claimed six pages and
  // production had none of them. A migration that lies about what it did is
  // worse than one that fails, so this uses the path whose target is not in
  // question.
  const statements = [];
  for (const [path, doc] of Object.entries(documents)) {
    const json = quote(JSON.stringify(doc));
    for (const stage of ['published', 'draft']) {
      statements.push(
        `INSERT INTO vedit_documents (key, stage, doc, updated_at, updated_by)
         VALUES (${quote(path)}, '${stage}', ${json}, unixepoch(), 'seed-vedit-pages')
         ON CONFLICT (key, stage) DO UPDATE SET
           doc = excluded.doc,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by;`,
      );
    }
  }

  const { writeFileSync, unlinkSync } = await import('node:fs');
  const { execFileSync } = await import('node:child_process');
  const file = `.vedit-seed-${process.pid}.sql`;
  writeFileSync(file, statements.join('\n'));

  try {
    execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', 'bmxc', remote ? '--remote' : '--local', '--file', file],
      { stdio: 'inherit' },
    );
  } finally {
    unlinkSync(file);
  }

  for (const [path, doc] of Object.entries(documents)) {
    console.log(`seeded ${path} — ${doc.inserted.length} components`);
  }

  // Read back rather than trust the write. This is the check that would have
  // caught the local/remote mix-up immediately.
  const verify = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'bmxc', remote ? '--remote' : '--local', '--json',
     '--command', "SELECT key FROM vedit_documents WHERE updated_by = 'seed-vedit-pages';"],
    { encoding: 'utf8' },
  );
  const seeded = new Set(
    (JSON.parse(verify)[0]?.results ?? []).map((row) => row.key),
  );
  const missing = Object.keys(documents).filter((path) => !seeded.has(path));
  if (missing.length) {
    console.error(`\nSeed did not land for: ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`\nverified ${seeded.size} pages in the ${remote ? 'remote' : 'local'} database`);
}

// Only run as a CLI; the test imports the builders above.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
