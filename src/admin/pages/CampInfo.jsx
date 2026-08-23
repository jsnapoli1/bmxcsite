import { useEffect, useState } from 'react';
import { getContent, saveContent, publishContent } from '../lib/api.js';

function isSameContent(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function CampInfo() {
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
    const data = await getContent('campinfo');
    setDraft(data.draft);
    setPublished(data.published);
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  const hasUnpublishedChanges = draft && published && !isSameContent(draft, published);

  function updateField(key, value) {
    setDraft({
      ...draft,
      fields: {
        ...draft.fields,
        [key]: { ...draft.fields[key], value },
      },
    });
  }

  async function handleSave() {
    const key = 'save';
    if (pending.has(key)) return;
    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await saveContent('campinfo', draft);
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
      await publishContent('campinfo');
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
      <section className="admin-section" aria-labelledby="campinfo-heading">
        <h2 id="campinfo-heading">Camp info</h2>
        {error
          ? <p className="admin-error" role="alert">{error}</p>
          : <p className="admin-notice" aria-busy="true">Loading…</p>}
      </section>
    );
  }

  const entries = Object.entries(draft.fields ?? {});

  return (
    <section className="admin-section" aria-labelledby="campinfo-heading">
      <h2 id="campinfo-heading">Camp info</h2>
      <p className="admin-help">
        These are the small facts that appear throughout the site, like the
        camp&rsquo;s phone number and address.
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

      <div className="campinfo-fields">
        {entries.map(([key, field]) => (
          <label className="admin-field admin-field--wide" key={key}>
            {field.label}
            <input
              type="text"
              value={field.value}
              onChange={(e) => updateField(key, e.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
