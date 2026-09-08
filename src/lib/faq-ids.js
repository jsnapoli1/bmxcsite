/**
 * Stable ids for FAQ questions.
 *
 * The visual editor keys an override on `faq.item.<id>`, so the id has to
 * outlive both rewording and reordering. `${category.id}-${index}` did
 * neither: /admin offers an explicit "reorder" control, so moving a question
 * up one row would slide the question below it into its override.
 *
 * Ids are minted once, when a question is created, and then carried in the
 * content document alongside `q` and `a`. Nothing derives one from the text,
 * because the text is the thing people edit.
 *
 * Kept free of React and of the editor so both the admin panel and the
 * public page can import it — the same reason visual-editor-pages.js exists.
 */

/** "Buses & Travel" -> "buses-travel". Shared with the category slugs. */
export function slugify(label) {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * A readable id for a question, unique within `taken`.
 *
 * Seeded from the question's opening words only as a convenience, so the
 * layers panel reads plainly. Once minted the id never changes, so later
 * rewording does not move it.
 */
export function mintQuestionId(question, taken = new Set()) {
  const stop = new Set(['the', 'a', 'an', 'and', 'or', 'for', 'of', 'in', 'is', 'it',
    'do', 'does', 'what', 'when', 'how', 'why', 'are', 'i', 'my', 'to', 'be']);
  const words = slugify(question).split('-').filter(Boolean);
  const kept = words.filter((w) => !stop.has(w)).slice(0, 4);
  const base = (kept.length ? kept : words.slice(0, 4)).join('-') || 'question';

  let id = base;
  let suffix = 2;
  while (taken.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

/**
 * Fill in ids for any question that predates them.
 *
 * Content already in D1 was written before questions had ids, and a document
 * is only rewritten when someone saves in /admin. This runs on read so an
 * unmigrated document still gets stable handles, and returns the input
 * untouched when every question already has one.
 */
export function withQuestionIds(categories) {
  if (!Array.isArray(categories)) return categories;

  const taken = new Set();
  for (const category of categories) {
    for (const item of category?.items ?? []) {
      if (item?.id) taken.add(item.id);
    }
  }

  let changed = false;
  const next = categories.map((category) => {
    const items = (category?.items ?? []).map((item) => {
      if (item?.id) return item;
      changed = true;
      const id = mintQuestionId(item?.q ?? '', taken);
      taken.add(id);
      return { ...item, id };
    });
    return items === category?.items ? category : { ...category, items };
  });

  return changed ? next : categories;
}
