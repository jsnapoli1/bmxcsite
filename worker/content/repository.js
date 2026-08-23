/**
 * Reads and writes the content areas moved into D1: staff, faq, merch, and
 * campinfo. This is the only module that knows the table layout — routes
 * and the editor UI never touch SQL directly.
 *
 * Every write (`saveArea`, `publishArea`) is a single `db.batch([...])` call.
 * D1 runs a batch as one transaction, so a failure partway through leaves
 * the area exactly as it was before the call, never half old / half new.
 */

/** The only areas this repository knows how to read or write. */
export const AREAS_WITH_CONTENT = Object.freeze(['staff', 'faq', 'merch', 'campinfo']);

export class UnknownAreaError extends Error {
  constructor(area) {
    super(`Unknown content area: ${area}`);
    this.name = 'UnknownAreaError';
    this.status = 400;
  }
}

function assertKnownArea(area) {
  if (!AREAS_WITH_CONTENT.includes(area)) {
    throw new UnknownAreaError(area);
  }
}

/**
 * Nested-status policy for staff and faq (the two areas with a
 * parent/child table pair):
 *
 * `saveArea` and `publishArea` always write or flip the whole area — parent
 * rows and their children — together in one batch, so this repository's own
 * write paths can never leave a published parent with draft children or the
 * reverse. But `getPublished` is written defensively rather than trusting
 * that invariant forever (a future direct SQL edit, a bug, a migration).
 *
 * Choice: a published group whose members are all draft is OMITTED from
 * `getPublished`, not shown with an empty member list. Reasoning: an empty
 * "Camp Directors" heading with no names under it looks like a bug to a
 * site visitor, and hides no information a draft member wouldn't already be
 * hiding. Omitting the group entirely degrades gracefully — the section
 * just doesn't appear until it has published content — whereas an empty
 * shell would need special-casing in every page component that renders it.
 * `getAll` (the editor view) is unfiltered, so editors always see the true
 * state including any inconsistency.
 */

// ---------------------------------------------------------------------------
// staff
// ---------------------------------------------------------------------------

async function readStaff(db, { publishedOnly }) {
  const groupSql = publishedOnly
    ? "SELECT * FROM staff_groups WHERE status = 'published' ORDER BY sort_order"
    : 'SELECT * FROM staff_groups ORDER BY sort_order';
  const memberSql = publishedOnly
    ? "SELECT * FROM staff_members WHERE status = 'published' ORDER BY group_id, sort_order"
    : 'SELECT * FROM staff_members ORDER BY group_id, sort_order';

  const [{ results: groupRows }, { results: memberRows }] = await Promise.all([
    db.prepare(groupSql).all(),
    db.prepare(memberSql).all(),
  ]);

  const membersByGroup = new Map();
  for (const member of memberRows) {
    const list = membersByGroup.get(member.group_id) ?? [];
    list.push({
      name: member.name,
      role: member.role,
      bio: member.bio,
      since: member.since,
    });
    membersByGroup.set(member.group_id, list);
  }

  const groups = groupRows
    .map((group) => ({
      title: group.title,
      members: membersByGroup.get(group.id) ?? [],
    }))
    // A published group with no published members has nothing to show.
    // See the nested-status policy comment above for why this is omitted
    // rather than rendered as an empty section. `getAll` never filters, so
    // this only ever removes rows in the published (public) read path.
    .filter((group) => !publishedOnly || group.members.length > 0);

  return { groups };
}

function saveStaffStatements(db, payload, editorEmail) {
  const groups = payload?.groups ?? [];

  const statements = [
    db.prepare('DELETE FROM staff_members'),
    db.prepare('DELETE FROM staff_groups'),
  ];

  groups.forEach((group, groupIndex) => {
    statements.push(
      db.prepare(
        `INSERT INTO staff_groups (id, title, sort_order, status, updated_at, updated_by)
         VALUES (?, ?, ?, 'draft', unixepoch(), ?)`,
      ).bind(groupIndex + 1, group.title, groupIndex, editorEmail),
    );

    (group.members ?? []).forEach((member, memberIndex) => {
      statements.push(
        db.prepare(
          `INSERT INTO staff_members
             (group_id, name, role, bio, since, sort_order, status, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, 'draft', unixepoch(), ?)`,
        ).bind(
          groupIndex + 1,
          member.name,
          member.role ?? null,
          member.bio ?? null,
          member.since ?? null,
          memberIndex,
          editorEmail,
        ),
      );
    });
  });

  return statements;
}

function publishStaffStatements(db, editorEmail) {
  return [
    db.prepare(
      "UPDATE staff_groups SET status = 'published', updated_at = unixepoch(), updated_by = ?",
    ).bind(editorEmail),
    db.prepare(
      "UPDATE staff_members SET status = 'published', updated_at = unixepoch(), updated_by = ?",
    ).bind(editorEmail),
  ];
}

// ---------------------------------------------------------------------------
// faq
// ---------------------------------------------------------------------------

async function readFaq(db, { publishedOnly }) {
  const categorySql = publishedOnly
    ? "SELECT * FROM faq_categories WHERE status = 'published' ORDER BY sort_order"
    : 'SELECT * FROM faq_categories ORDER BY sort_order';
  const itemSql = publishedOnly
    ? "SELECT * FROM faq_items WHERE status = 'published' ORDER BY category_id, sort_order"
    : 'SELECT * FROM faq_items ORDER BY category_id, sort_order';

  const [{ results: categoryRows }, { results: itemRows }] = await Promise.all([
    db.prepare(categorySql).all(),
    db.prepare(itemSql).all(),
  ]);

  const itemsByCategory = new Map();
  for (const item of itemRows) {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push({ question: item.question, answer: item.answer });
    itemsByCategory.set(item.category_id, list);
  }

  const categories = categoryRows
    .map((category) => ({
      slug: category.slug,
      label: category.label,
      items: itemsByCategory.get(category.id) ?? [],
    }))
    // Same reasoning as staff groups: an empty published category has
    // nothing to show, so it's omitted rather than rendered empty.
    .filter((category) => !publishedOnly || category.items.length > 0);

  return { categories };
}

function saveFaqStatements(db, payload, editorEmail) {
  const categories = payload?.categories ?? [];

  const statements = [
    db.prepare('DELETE FROM faq_items'),
    db.prepare('DELETE FROM faq_categories'),
  ];

  categories.forEach((category, categoryIndex) => {
    statements.push(
      db.prepare(
        `INSERT INTO faq_categories (id, slug, label, sort_order, status, updated_at, updated_by)
         VALUES (?, ?, ?, ?, 'draft', unixepoch(), ?)`,
      ).bind(categoryIndex + 1, category.slug ?? null, category.label, categoryIndex, editorEmail),
    );

    (category.items ?? []).forEach((item, itemIndex) => {
      statements.push(
        db.prepare(
          `INSERT INTO faq_items
             (category_id, question, answer, sort_order, status, updated_at, updated_by)
           VALUES (?, ?, ?, ?, 'draft', unixepoch(), ?)`,
        ).bind(categoryIndex + 1, item.question, item.answer, itemIndex, editorEmail),
      );
    });
  });

  return statements;
}

function publishFaqStatements(db, editorEmail) {
  return [
    db.prepare(
      "UPDATE faq_categories SET status = 'published', updated_at = unixepoch(), updated_by = ?",
    ).bind(editorEmail),
    db.prepare(
      "UPDATE faq_items SET status = 'published', updated_at = unixepoch(), updated_by = ?",
    ).bind(editorEmail),
  ];
}

// ---------------------------------------------------------------------------
// merch
// ---------------------------------------------------------------------------

async function readMerch(db, { publishedOnly }) {
  const itemSql = publishedOnly
    ? "SELECT * FROM merch_items WHERE status = 'published' ORDER BY sort_order"
    : 'SELECT * FROM merch_items ORDER BY sort_order';
  const factSql = publishedOnly
    ? "SELECT * FROM merch_facts WHERE status = 'published' ORDER BY sort_order"
    : 'SELECT * FROM merch_facts ORDER BY sort_order';

  const [{ results: itemRows }, { results: factRows }] = await Promise.all([
    db.prepare(itemSql).all(),
    db.prepare(factSql).all(),
  ]);

  return {
    // `id` here is the page's string slug ('hoodie', 'singlet'), not the
    // numeric primary key. src/pages/Merch.jsx uses it as a React key and
    // as the item identifier, so the DB's numeric `id` column is never
    // exposed through this shape.
    items: itemRows.map((item) => ({
      id: item.slug,
      name: item.name,
      fit: item.fit,
      material: item.material,
      color: item.color,
      note: item.note,
      image: item.image,
      tag: item.tag,
      // Strict coercion: D1 stores this as INTEGER 0/1. Only `=== 1` counts
      // as true, so any other stored value (null, unexpected int) reads as
      // false rather than being truthy-coerced.
      hero: item.hero === 1,
    })),
    facts: factRows.map((fact) => ({
      title: fact.title,
      body: fact.body,
      tag: fact.tag,
    })),
  };
}

function saveMerchStatements(db, payload, editorEmail) {
  const items = payload?.items ?? [];
  const facts = payload?.facts ?? [];

  const statements = [
    db.prepare('DELETE FROM merch_items'),
    db.prepare('DELETE FROM merch_facts'),
  ];

  items.forEach((item, index) => {
    statements.push(
      db.prepare(
        `INSERT INTO merch_items
           (slug, name, fit, material, color, note, image, tag, hero, sort_order, status, updated_at, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', unixepoch(), ?)`,
      ).bind(
        item.id,
        item.name,
        item.fit ?? null,
        item.material ?? null,
        item.color ?? null,
        item.note ?? null,
        item.image ?? null,
        item.tag ?? null,
        // Strict coercion on write too: only literal `true` sets the flag.
        // Anything else (undefined, a truthy non-boolean) stores 0.
        item.hero === true ? 1 : 0,
        index,
        editorEmail,
      ),
    );
  });

  facts.forEach((fact, index) => {
    statements.push(
      db.prepare(
        `INSERT INTO merch_facts (title, body, tag, sort_order, status, updated_at, updated_by)
         VALUES (?, ?, ?, ?, 'draft', unixepoch(), ?)`,
      ).bind(fact.title, fact.body, fact.tag ?? null, index, editorEmail),
    );
  });

  return statements;
}

function publishMerchStatements(db, editorEmail) {
  return [
    db.prepare(
      "UPDATE merch_items SET status = 'published', updated_at = unixepoch(), updated_by = ?",
    ).bind(editorEmail),
    db.prepare(
      "UPDATE merch_facts SET status = 'published', updated_at = unixepoch(), updated_by = ?",
    ).bind(editorEmail),
  ];
}

// ---------------------------------------------------------------------------
// campinfo
// ---------------------------------------------------------------------------

async function readCampInfo(db, { publishedOnly }) {
  const sql = publishedOnly
    ? "SELECT * FROM camp_fields WHERE status = 'published' ORDER BY key"
    : 'SELECT * FROM camp_fields ORDER BY key';

  const { results: rows } = await db.prepare(sql).all();

  const fields = {};
  for (const row of rows) {
    fields[row.key] = { value: row.value, label: row.label };
  }

  return { fields };
}

function saveCampInfoStatements(db, payload, editorEmail) {
  const fields = payload?.fields ?? {};
  const keys = Object.keys(fields);

  const statements = [db.prepare('DELETE FROM camp_fields')];

  keys.forEach((key) => {
    const field = fields[key];
    statements.push(
      db.prepare(
        `INSERT INTO camp_fields (key, value, label, status, updated_at, updated_by)
         VALUES (?, ?, ?, 'draft', unixepoch(), ?)`,
      ).bind(key, field.value, field.label, editorEmail),
    );
  });

  return statements;
}

function publishCampInfoStatements(db, editorEmail) {
  return [
    db.prepare(
      "UPDATE camp_fields SET status = 'published', updated_at = unixepoch(), updated_by = ?",
    ).bind(editorEmail),
  ];
}

// ---------------------------------------------------------------------------
// area dispatch
// ---------------------------------------------------------------------------

const READERS = {
  staff: readStaff,
  faq: readFaq,
  merch: readMerch,
  campinfo: readCampInfo,
};

const SAVE_STATEMENT_BUILDERS = {
  staff: saveStaffStatements,
  faq: saveFaqStatements,
  merch: saveMerchStatements,
  campinfo: saveCampInfoStatements,
};

const PUBLISH_STATEMENT_BUILDERS = {
  staff: publishStaffStatements,
  faq: publishFaqStatements,
  merch: publishMerchStatements,
  campinfo: publishCampInfoStatements,
};

/** The published content for an area, shaped for the public pages. */
export async function getPublished(db, area) {
  assertKnownArea(area);
  return READERS[area](db, { publishedOnly: true });
}

/** Draft and published content for an area, shaped for the editor. */
export async function getAll(db, area) {
  assertKnownArea(area);
  return READERS[area](db, { publishedOnly: false });
}

/**
 * Replaces an area's rows with `payload`, as drafts, preserving array
 * order via `sort_order`. Runs as a single batch: delete-then-insert can
 * never be observed half-done.
 */
export async function saveArea(db, area, payload, editorEmail) {
  assertKnownArea(area);
  const statements = SAVE_STATEMENT_BUILDERS[area](db, payload, editorEmail);
  await db.batch(statements);
}

/**
 * Flips every row in the area from draft to published and bumps
 * `content_version` in the same batch, so a reader can never see a
 * published area without the version number that invalidates its cache.
 * Returns the new version.
 */
export async function publishArea(db, area, editorEmail) {
  assertKnownArea(area);

  const statements = [
    ...PUBLISH_STATEMENT_BUILDERS[area](db, editorEmail),
    // Upsert rather than UPDATE: the row is seeded by the migration, but
    // tests (and any future reset) can leave `content_version` empty for an
    // area. An UPDATE against a missing row silently affects zero rows,
    // which would make `getVersion` return null after a publish that
    // otherwise succeeded — an upsert makes publishArea correct regardless
    // of whether the seed row survived.
    db.prepare(
      `INSERT INTO content_version (area, version) VALUES (?, 2)
       ON CONFLICT (area) DO UPDATE SET version = version + 1`,
    ).bind(area),
  ];

  await db.batch(statements);

  return getVersion(db, area);
}

/**
 * The current version number for an area. Falls back to 1 (the migration's
 * seed value) if the row is missing, rather than throwing — callers should
 * be able to ask "what version is this" even if `content_version` was wiped
 * or an area's row hasn't been created yet.
 */
export async function getVersion(db, area) {
  assertKnownArea(area);
  const row = await db
    .prepare('SELECT version FROM content_version WHERE area = ?')
    .bind(area)
    .first();
  return row ? row.version : 1;
}
