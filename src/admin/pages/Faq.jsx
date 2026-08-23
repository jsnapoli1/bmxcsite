import { useEffect, useState } from 'react';
import { getContent, saveContent, publishContent } from '../lib/api.js';
import { reorder } from '../lib/reorder.js';
import OrderedList from '../components/OrderedList.jsx';

const EMPTY_ITEM = { q: '', a: '' };

function isSameContent(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function Faq() {
  const [draft, setDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(() => new Set());

  function markPending(key) {
    setPending((prev) => new Set(prev).add(key));
  }

  function clearPending(key) {
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function refresh() {
    const data = await getContent('faq');
    setDraft(data.draft);
    setPublished(data.published);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  const hasUnpublishedChanges = draft && published && !isSameContent(draft, published);

  function updateCategories(nextCategories) {
    setDraft({ ...draft, categories: nextCategories });
  }

  function updateCategory(categoryIndex, changes) {
    updateCategories(draft.categories.map(
      (category, i) => (i === categoryIndex ? { ...category, ...changes } : category),
    ));
  }

  function addCategory() {
    updateCategories([...draft.categories, { id: '', label: 'New category', items: [] }]);
  }

  function removeCategory(categoryIndex) {
    const category = draft.categories[categoryIndex];
    const itemCount = category.items?.length ?? 0;
    const warning = itemCount > 0
      ? `Delete "${category.label}" and its ${itemCount} question${itemCount === 1 ? '' : 's'}? This cannot be undone.`
      : `Delete "${category.label}"? This cannot be undone.`;
    if (!window.confirm(warning)) return;
    updateCategories(draft.categories.filter((_, i) => i !== categoryIndex));
  }

  function reorderCategories(fromIndex, toIndex) {
    updateCategories(reorder(draft.categories, fromIndex, toIndex));
  }

  function addItem(categoryIndex) {
    const category = draft.categories[categoryIndex];
    updateCategory(categoryIndex, { items: [...(category.items ?? []), { ...EMPTY_ITEM }] });
  }

  function updateItem(categoryIndex, itemIndex, changes) {
    const category = draft.categories[categoryIndex];
    const items = category.items.map(
      (item, i) => (i === itemIndex ? { ...item, ...changes } : item),
    );
    updateCategory(categoryIndex, { items });
  }

  function removeItem(categoryIndex, itemIndex) {
    const category = draft.categories[categoryIndex];
    const item = category.items[itemIndex];
    if (!window.confirm(`Delete the question "${item.q || '(untitled)'}"? This cannot be undone.`)) return;
    updateCategory(categoryIndex, { items: category.items.filter((_, i) => i !== itemIndex) });
  }

  function reorderItems(categoryIndex, fromIndex, toIndex) {
    const category = draft.categories[categoryIndex];
    updateCategory(categoryIndex, { items: reorder(category.items, fromIndex, toIndex) });
  }

  async function handleSave() {
    const key = 'save';
    if (pending.has(key)) return;
    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await saveContent('faq', draft);
      await refresh();
      setStatus('Saved as a draft. The public site has not changed yet.');
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  async function handlePublish() {
    const key = 'publish';
    if (pending.has(key)) return;
    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await publishContent('faq');
      await refresh();
      setStatus('Published. The public site now shows this.');
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  if (!draft) {
    return (
      <section className="admin-section" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Questions & answers</h2>
        {error
          ? <p className="admin-error" role="alert">{error}</p>
          : <p className="admin-notice" aria-busy="true">Loading…</p>}
      </section>
    );
  }

  return (
    <section className="admin-section" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Questions & answers</h2>
      <p className="admin-help">
        Categories appear in this order, and questions appear in this order
        within each category. Answers are used exactly as typed here, so
        keep the camp&rsquo;s own wording.
      </p>

      {error && <p className="admin-error" role="alert">{error}</p>}
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
          disabled={pending.has('save')}
          aria-busy={pending.has('save')}
          onClick={handleSave}
        >
          Save draft
        </button>
        <button
          type="button"
          className="admin-publish"
          disabled={pending.has('publish')}
          aria-busy={pending.has('publish')}
          onClick={handlePublish}
        >
          Publish
        </button>
      </div>

      <OrderedList
        items={draft.categories}
        getKey={(category, i) => `category-${i}`}
        onReorder={reorderCategories}
        renderItem={(category, categoryIndex) => (
          <div className="faq-category">
            <div className="faq-category__header">
              <label className="admin-field">
                Category name
                <input
                  type="text"
                  value={category.label}
                  onChange={(e) => updateCategory(categoryIndex, { label: e.target.value })}
                />
              </label>
              <label className="admin-field">
                Category ID
                <input
                  type="text"
                  value={category.id ?? ''}
                  onChange={(e) => updateCategory(categoryIndex, { id: e.target.value })}
                />
              </label>
              <button
                type="button"
                className="admin-remove"
                onClick={() => removeCategory(categoryIndex)}
              >
                Delete category
              </button>
            </div>

            <OrderedList
              items={category.items ?? []}
              getKey={(item, i) => `item-${i}`}
              onReorder={(from, to) => reorderItems(categoryIndex, from, to)}
              renderItem={(item, itemIndex) => (
                <div className="faq-item">
                  <label className="admin-field admin-field--wide">
                    Question
                    <input
                      type="text"
                      value={item.q}
                      onChange={(e) => updateItem(categoryIndex, itemIndex, { q: e.target.value })}
                    />
                  </label>
                  <label className="admin-field admin-field--wide">
                    Answer
                    <textarea
                      value={item.a}
                      onChange={(e) => updateItem(categoryIndex, itemIndex, { a: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="admin-remove"
                    onClick={() => removeItem(categoryIndex, itemIndex)}
                  >
                    Delete question
                  </button>
                </div>
              )}
            />
            <button type="button" className="admin-add" onClick={() => addItem(categoryIndex)}>
              Add a question to {category.label}
            </button>
          </div>
        )}
      />

      <button type="button" className="admin-add" onClick={addCategory}>
        Add a category
      </button>
    </section>
  );
}
