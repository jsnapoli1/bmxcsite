import { useEffect, useState } from 'react';
import { getContent, saveContent, publishContent } from '../lib/api.js';
import { reorder } from '../lib/reorder.js';
import { contentMatchesPublished } from '../lib/content-diff.js';
import { usePending } from '../lib/use-pending.js';
import OrderedList from '../components/OrderedList.jsx';
import { Busy, Failure } from '../components/States.jsx';
import { slugify, mintQuestionId } from '../../lib/faq-ids.js';

/**
 * The Q&A editor: one category at a time, chosen from a rail.
 *
 * Every category used to render expanded at once — seven of them, 44
 * questions, one unbroken scroll with no way to collapse anything or jump to
 * a category. The rail mirrors the public FAQ page, which is also how a
 * director thinks about this content.
 */

const EMPTY_ITEM = { q: '', a: '' };

export default function Faq() {
  const [draft, setDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  // Which category is open, by id. Falls back to the first below, so the
  // page is never showing nothing.
  const [activeId, setActiveId] = useState(null);
  const { isPending, run } = usePending();

  async function refresh() {
    const data = await getContent('faq');
    setDraft(data.draft);
    setPublished(data.published);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  const hasUnpublishedChanges =
    draft && published && !contentMatchesPublished('faq', draft, published);

  const categories = draft?.categories ?? [];
  const activeIndex = Math.max(0, categories.findIndex((c) => c.id === activeId));
  const active = categories[activeIndex] ?? null;

  function updateCategories(nextCategories) {
    setDraft((prev) => ({ ...prev, categories: nextCategories }));
  }

  function updateCategory(categoryIndex, changes) {
    updateCategories(categories.map(
      (category, i) => (i === categoryIndex ? { ...category, ...changes } : category),
    ));
  }

  /**
   * Ids are minted here and never shown or edited.
   *
   * They are load-bearing — `src/pages/Faq.jsx` renders the camper mailing
   * addresses only under the category whose id is `mail`, so changing one
   * would make those addresses vanish from the public site. That is a reason
   * to keep an id unchangeable, not a reason to put it in front of a camp
   * director: it is an internal handle, and a readonly field explaining why
   * it cannot be touched is noise on a page about questions and answers.
   */
  function addCategory() {
    const existingIds = new Set(categories.map((category) => category.id));
    const base = slugify('New category') || 'category';
    let id = base;
    let suffix = 2;
    while (existingIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }
    updateCategories([...categories, { id, label: 'New category', items: [] }]);
    setActiveId(id);
  }

  function removeCategory(categoryIndex) {
    const category = categories[categoryIndex];
    const itemCount = category.items?.length ?? 0;
    const lines = [
      itemCount > 0
        ? `Delete "${category.label}" and its ${itemCount} question${itemCount === 1 ? '' : 's'}? This cannot be undone.`
        : `Delete "${category.label}"? This cannot be undone.`,
    ];
    // The one consequence nobody could guess from the page: the camper
    // mailing addresses are shown under this category and nowhere else, so
    // deleting it takes them off the public site too. Said here rather than
    // in a field about ids, which is where it used to live.
    if (category.id === 'mail') {
      lines.push('', 'The camper mailing addresses are shown under this category. Deleting it removes them from the FAQ page.');
    }
    if (!window.confirm(lines.join('\n'))) return;
    updateCategories(categories.filter((_, i) => i !== categoryIndex));
    setActiveId(null);
  }

  function addItem(categoryIndex) {
    const category = categories[categoryIndex];
    // Every question carries an id so the visual editor can key an override
    // on it. Minted here, once, because reordering below would make any id
    // derived from position or wording reattach to a different question.
    const taken = new Set(
      categories.flatMap((entry) => (entry.items ?? []).map((item) => item.id)),
    );
    const item = { ...EMPTY_ITEM, id: mintQuestionId('question', taken) };
    updateCategory(categoryIndex, { items: [...(category.items ?? []), item] });
  }

  function updateItem(categoryIndex, itemIndex, changes) {
    const category = categories[categoryIndex];
    updateCategory(categoryIndex, {
      items: category.items.map((item, i) => (i === itemIndex ? { ...item, ...changes } : item)),
    });
  }

  function removeItem(categoryIndex, itemIndex) {
    const item = categories[categoryIndex].items[itemIndex];
    if (!window.confirm(`Delete the question "${item.q || '(untitled)'}"? This cannot be undone.`)) return;
    updateCategory(categoryIndex, {
      items: categories[categoryIndex].items.filter((_, i) => i !== itemIndex),
    });
  }

  async function handleSave() {
    setError(null);
    setStatus(null);
    await run('save', async () => {
      try {
        await saveContent('faq', draft);
        await refresh();
        setStatus('Saved as a draft. The public site has not changed yet.');
      } catch (err) {
        setError(err.message);
      }
    });
  }

  async function handlePublish() {
    setError(null);
    setStatus(null);
    await run('publish', async () => {
      try {
        await publishContent('faq');
        await refresh();
        setStatus('Published. The public site now shows this.');
      } catch (err) {
        setError(err.message);
      }
    });
  }

  if (error && !draft) return <Failure message={error} />;
  if (!draft) return <Busy label="Loading questions…" />;

  return (
    <section className="admin-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Questions &amp; answers</h2>

      <Failure message={error} />
      {status && <p className="admin-status" role="status">{status}</p>}

      <p className="admin-draft-state">
        {hasUnpublishedChanges
          ? 'This has unsaved or unpublished changes. The public site still shows the last published version.'
          : 'The public site matches what is shown here.'}
      </p>

      <div className="admin-actions">
        <button
          type="button"
          className="admin-save"
          disabled={isPending('save')}
          aria-busy={isPending('save')}
          onClick={handleSave}
        >
          Save draft
        </button>
        <button
          type="button"
          className="admin-publish"
          disabled={isPending('publish')}
          aria-busy={isPending('publish')}
          onClick={handlePublish}
        >
          Publish
        </button>
      </div>

      <div className="faq-editor">
        <nav className="faq-editor__rail" aria-label="Question categories">
          <p className="admin-nav__label" aria-hidden="true">Categories</p>
          {categories.map((category, index) => (
            <button
              key={category.id ?? `category-${index}`}
              type="button"
              className={
                index === activeIndex
                  ? 'faq-editor__tab faq-editor__tab--active'
                  : 'faq-editor__tab'
              }
              aria-current={index === activeIndex ? 'true' : undefined}
              onClick={() => setActiveId(category.id)}
            >
              <span>{category.label}</span>
              <span className="faq-editor__count">{category.items?.length ?? 0}</span>
            </button>
          ))}
          <button type="button" className="admin-add" onClick={addCategory}>
            Add a category
          </button>
        </nav>

        {active ? (
          <div className="faq-editor__panel">
            <div className="faq-category__header">
              <label className="admin-field">
                Category name
                <input
                  type="text"
                  value={active.label}
                  onChange={(e) => updateCategory(activeIndex, { label: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="admin-remove"
                onClick={() => removeCategory(activeIndex)}
              >
                Delete category
              </button>
            </div>

            <p className="admin-help">
              Questions appear in this order under {active.label}.
            </p>

            <OrderedList
              items={active.items ?? []}
              // Keyed on the question's own minted id, not its position: this
              // panel reorders, and a positional key would carry one row's
              // focus onto another.
              getKey={(item, i) => item.id ?? `item-${i}`}
              onReorder={(from, to) => updateCategory(activeIndex, {
                items: reorder(active.items, from, to),
              })}
              renderItem={(item, itemIndex) => (
                <div className="faq-item">
                  <label className="admin-field admin-field--wide">
                    Question
                    <input
                      type="text"
                      value={item.q}
                      onChange={(e) => updateItem(activeIndex, itemIndex, { q: e.target.value })}
                    />
                  </label>
                  <label className="admin-field admin-field--wide">
                    Answer
                    <textarea
                      value={item.a}
                      onChange={(e) => updateItem(activeIndex, itemIndex, { a: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-remove"
                    onClick={() => removeItem(activeIndex, itemIndex)}
                  >
                    Delete question
                  </button>
                </div>
              )}
            />

            <button
              type="button"
              className="admin-add"
              onClick={() => addItem(activeIndex)}
            >
              Add a question to {active.label}
            </button>
          </div>
        ) : (
          <div className="faq-editor__panel">
            <p className="admin-notice">
              There are no categories yet. Add one to start.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
