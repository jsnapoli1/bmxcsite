import { useEffect, useState } from 'react';
import { getContent, saveContent, publishContent } from '../lib/api.js';
import { reorder } from '../lib/reorder.js';
import OrderedList from '../components/OrderedList.jsx';

const EMPTY_ITEM = {
  id: '', name: '', fit: '', material: '', color: '', note: '', image: '', tag: '', hero: false,
};
const EMPTY_FACT = { title: '', body: '', tag: '' };

function isSameContent(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function Merch() {
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
    const data = await getContent('merch');
    setDraft(data.draft);
    setPublished(data.published);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  const hasUnpublishedChanges = draft && published && !isSameContent(draft, published);

  function updateItems(nextItems) {
    setDraft({ ...draft, items: nextItems });
  }

  function updateItem(itemIndex, changes) {
    updateItems(draft.items.map(
      (item, i) => (i === itemIndex ? { ...item, ...changes } : item),
    ));
  }

  function addItem() {
    updateItems([...draft.items, { ...EMPTY_ITEM }]);
  }

  function removeItem(itemIndex) {
    const item = draft.items[itemIndex];
    if (!window.confirm(`Delete "${item.name || 'this item'}"? This cannot be undone.`)) return;
    updateItems(draft.items.filter((_, i) => i !== itemIndex));
  }

  function reorderItems(fromIndex, toIndex) {
    updateItems(reorder(draft.items, fromIndex, toIndex));
  }

  function updateFacts(nextFacts) {
    setDraft({ ...draft, facts: nextFacts });
  }

  function updateFact(factIndex, changes) {
    updateFacts(draft.facts.map(
      (fact, i) => (i === factIndex ? { ...fact, ...changes } : fact),
    ));
  }

  function addFact() {
    updateFacts([...draft.facts, { ...EMPTY_FACT }]);
  }

  function removeFact(factIndex) {
    const fact = draft.facts[factIndex];
    if (!window.confirm(`Delete "${fact.title || 'this fact'}"? This cannot be undone.`)) return;
    updateFacts(draft.facts.filter((_, i) => i !== factIndex));
  }

  function reorderFacts(fromIndex, toIndex) {
    updateFacts(reorder(draft.facts, fromIndex, toIndex));
  }

  async function handleSave() {
    const key = 'save';
    if (pending.has(key)) return;
    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await saveContent('merch', draft);
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
      await publishContent('merch');
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
      <section className="admin-section" aria-labelledby="merch-heading">
        <h2 id="merch-heading">Merch</h2>
        {error
          ? <p className="admin-error" role="alert">{error}</p>
          : <p className="admin-notice" aria-busy="true">Loading…</p>}
      </section>
    );
  }

  return (
    <section className="admin-section" aria-labelledby="merch-heading">
      <h2 id="merch-heading">Merch</h2>
      <p className="admin-help">
        Items and facts appear on the merch page in the order shown here.
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

      <h3 className="admin-subheading">Items</h3>
      <OrderedList
        items={draft.items}
        getKey={(item, i) => `item-${i}`}
        onReorder={reorderItems}
        renderItem={(item, itemIndex) => (
          <div className="merch-item">
            <label className="admin-field">
              ID
              <input
                type="text"
                value={item.id}
                onChange={(e) => updateItem(itemIndex, { id: e.target.value })}
              />
            </label>
            <label className="admin-field">
              Name
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateItem(itemIndex, { name: e.target.value })}
              />
            </label>
            <label className="admin-field">
              Fit
              <input
                type="text"
                value={item.fit ?? ''}
                onChange={(e) => updateItem(itemIndex, { fit: e.target.value })}
              />
            </label>
            <label className="admin-field">
              Material
              <input
                type="text"
                value={item.material ?? ''}
                onChange={(e) => updateItem(itemIndex, { material: e.target.value })}
              />
            </label>
            <label className="admin-field">
              Color
              <input
                type="text"
                value={item.color ?? ''}
                onChange={(e) => updateItem(itemIndex, { color: e.target.value })}
              />
            </label>
            <label className="admin-field">
              Tag
              <input
                type="text"
                value={item.tag ?? ''}
                onChange={(e) => updateItem(itemIndex, { tag: e.target.value })}
              />
            </label>
            <label className="admin-field">
              Image
              <input
                type="text"
                value={item.image ?? ''}
                onChange={(e) => updateItem(itemIndex, { image: e.target.value })}
              />
            </label>
            <label className="admin-field admin-field--checkbox">
              <input
                type="checkbox"
                checked={Boolean(item.hero)}
                onChange={(e) => updateItem(itemIndex, { hero: e.target.checked })}
              />
              Feature this item
            </label>
            <label className="admin-field admin-field--wide">
              Note
              <textarea
                value={item.note ?? ''}
                onChange={(e) => updateItem(itemIndex, { note: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="admin-remove"
              onClick={() => removeItem(itemIndex)}
            >
              Delete item
            </button>
          </div>
        )}
      />
      <button type="button" className="admin-add" onClick={addItem}>
        Add an item
      </button>

      <h3 className="admin-subheading">Facts</h3>
      <OrderedList
        items={draft.facts}
        getKey={(fact, i) => `fact-${i}`}
        onReorder={reorderFacts}
        renderItem={(fact, factIndex) => (
          <div className="merch-fact">
            <label className="admin-field">
              Title
              <input
                type="text"
                value={fact.title}
                onChange={(e) => updateFact(factIndex, { title: e.target.value })}
              />
            </label>
            <label className="admin-field">
              Tag
              <input
                type="text"
                value={fact.tag ?? ''}
                onChange={(e) => updateFact(factIndex, { tag: e.target.value })}
              />
            </label>
            <label className="admin-field admin-field--wide">
              Body
              <textarea
                value={fact.body}
                onChange={(e) => updateFact(factIndex, { body: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="admin-remove"
              onClick={() => removeFact(factIndex)}
            >
              Delete fact
            </button>
          </div>
        )}
      />
      <button type="button" className="admin-add" onClick={addFact}>
        Add a fact
      </button>
    </section>
  );
}
