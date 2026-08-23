import { useEffect, useRef, useState } from 'react';
import {
  listMedia, uploadMedia, updateMedia, publishMedia, unpublishMedia, deleteMedia,
} from '../lib/api.js';

/**
 * Photo & video library. Private and public media are two visually distinct
 * groups, private first — a staffer must never have to guess whether a
 * photo is already visible to the public. Some camp photos show
 * individually identifiable minors (see CLAUDE.md), so every control that
 * changes what is public asks for a confirmation naming the consequence in
 * plain words, and publishing is blocked outright — not just discouraged —
 * until the photo has alt text.
 *
 * Private photos have no public URL: `/media/:key` (worker/routes/media.js)
 * serves only rows with status = 'public', by design. There is no way to
 * preview a private photo's pixels from the admin panel without adding a
 * second public-reachable route for private bytes, which would undo the
 * entire point of the private/public split. So a private row renders a
 * labelled placeholder instead of an <img>, never a broken image or (worse)
 * a request that would have to expose the bytes to succeed.
 */
export default function Media() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState(null);
  const [pending, setPending] = useState(() => new Set());
  const [altDrafts, setAltDrafts] = useState({});
  const fileInputRef = useRef(null);

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
    const { media } = await listMedia();
    setItems(media);
    // Seed the alt-text draft inputs from the server's current values, but
    // only for keys not already being edited — otherwise a refresh() that
    // races an in-progress edit would clobber what the director just typed.
    setAltDrafts((prev) => {
      const next = { ...prev };
      for (const item of media) {
        if (!(item.key in next)) next[item.key] = item.alt_text ?? '';
      }
      return next;
    });
  }

  useEffect(() => { refresh().catch((err) => setError(err.message)); }, []);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const key = 'upload';
    if (pending.has(key)) return;

    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await uploadMedia(file);
      await refresh();
      setStatus('Uploaded. This photo is private — it is not visible on the public site.');
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
      // Always clear the file input, even on failure, so choosing the same
      // file again fires a change event (the browser would otherwise treat
      // an identical selection as a no-op).
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSaveAltText(item) {
    const key = `alt:${item.key}`;
    if (pending.has(key)) return;
    const altText = altDrafts[item.key] ?? '';

    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await updateMedia(item.key, { altText });
      await refresh();
      setStatus('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  async function handlePublish(item) {
    const key = `publish:${item.key}`;
    if (pending.has(key)) return;

    const confirmed = window.confirm(
      `Publish "${item.filename}"? This makes the photo visible to anyone on the internet, `
      + 'not just people signed in here. This cannot be undone by itself — you would need to '
      + 'come back and unpublish it.',
    );
    if (!confirmed) return;

    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await publishMedia(item.key);
      await refresh();
      setStatus(`Published "${item.filename}". It is now visible to anyone on the internet.`);
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  async function handleUnpublish(item) {
    const key = `unpublish:${item.key}`;
    if (pending.has(key)) return;

    const confirmed = window.confirm(
      `Unpublish "${item.filename}"? It will stop being visible to the public immediately. `
      + 'Anyone with the direct image link will also lose access.',
    );
    if (!confirmed) return;

    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await unpublishMedia(item.key);
      await refresh();
      setStatus(`Unpublished "${item.filename}". It is private again.`);
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  async function handleDelete(item) {
    const key = `delete:${item.key}`;
    if (pending.has(key)) return;

    const consequence = item.status === 'public'
      ? 'It is currently PUBLIC — deleting it removes it from the public site immediately, and this cannot be undone.'
      : 'This cannot be undone.';
    const confirmed = window.confirm(`Delete "${item.filename}" permanently? ${consequence}`);
    if (!confirmed) return;

    setError(null);
    setStatus(null);
    markPending(key);
    try {
      await deleteMedia(item.key);
      await refresh();
      setStatus(`Deleted "${item.filename}".`);
    } catch (err) {
      setError(err.message);
    } finally {
      clearPending(key);
    }
  }

  if (!items) {
    return (
      <section className="admin-section" aria-labelledby="media-heading">
        <h2 id="media-heading">Photos &amp; videos</h2>
        {error
          ? <p className="admin-error" role="alert">{error}</p>
          : <p className="admin-notice" aria-busy="true">Loading…</p>}
      </section>
    );
  }

  const privateItems = items.filter((item) => item.status === 'private');
  const publicItems = items.filter((item) => item.status === 'public');

  return (
    <section className="admin-section" aria-labelledby="media-heading">
      <h2 id="media-heading">Photos &amp; videos</h2>
      <p className="admin-help">
        A new upload is always private. Add alt text, then publish it
        yourself when you want it on the public site &mdash; nothing goes
        public automatically.
      </p>

      {error && <p className="admin-error" role="alert">{error}</p>}
      {status && <p className="admin-status" role="status">{status}</p>}

      <div className="admin-actions">
        <label className="admin-upload">
          <span>{pending.has('upload') ? 'Uploading…' : 'Upload a photo'}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={pending.has('upload')}
            onChange={handleUpload}
          />
        </label>
      </div>

      <MediaGroup
        groupKind="private"
        title="Private — not visible on the public site"
        emptyMessage="No private photos. Newly uploaded photos will appear here first."
        items={privateItems}
        altDrafts={altDrafts}
        setAltDrafts={setAltDrafts}
        pending={pending}
        onSaveAltText={handleSaveAltText}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onDelete={handleDelete}
      />

      <MediaGroup
        groupKind="public"
        title="Public — visible to anyone on the internet"
        emptyMessage="No published photos yet."
        items={publicItems}
        altDrafts={altDrafts}
        setAltDrafts={setAltDrafts}
        pending={pending}
        onSaveAltText={handleSaveAltText}
        onPublish={handlePublish}
        onUnpublish={handleUnpublish}
        onDelete={handleDelete}
      />
    </section>
  );
}

function MediaGroup({
  groupKind, title, emptyMessage, items, altDrafts, setAltDrafts, pending,
  onSaveAltText, onPublish, onUnpublish, onDelete,
}) {
  return (
    <div className={`media-group media-group--${groupKind}`}>
      <h3 className="admin-subheading">{title}</h3>
      {items.length === 0 ? (
        <p className="admin-help">{emptyMessage}</p>
      ) : (
        <ul className="media-list">
          {items.map((item) => {
            const altText = altDrafts[item.key] ?? '';
            const hasAltText = altText.trim() !== '';
            const altKey = `alt:${item.key}`;
            const publishKey = `publish:${item.key}`;
            const unpublishKey = `unpublish:${item.key}`;
            const deleteKey = `delete:${item.key}`;

            return (
              <li className="media-row" key={item.key}>
                <div className="media-row__preview">
                  {item.status === 'public' ? (
                    <img
                      src={`/media/${item.key}`}
                      alt={item.alt_text ?? ''}
                      width="120"
                      height="120"
                      loading="lazy"
                    />
                  ) : (
                    <div className="media-row__placeholder" role="img" aria-label={`${item.filename}, private, cannot be previewed until published`}>
                      Private &mdash; cannot be
                      previewed until published
                    </div>
                  )}
                </div>

                <div className="media-row__body">
                  <p className="media-row__filename">{item.filename}</p>
                  <p className="media-row__meta">
                    {item.content_type} &middot; {formatBytes(item.size_bytes)}
                    {item.status === 'public' && item.published_by
                      ? ` · Published by ${item.published_by}`
                      : ` · Uploaded by ${item.uploaded_by}`}
                  </p>

                  <label className="admin-field admin-field--wide">
                    Alt text
                    <textarea
                      value={altText}
                      placeholder="Describe what the photo shows, for people using a screen reader."
                      onChange={(e) => setAltDrafts((prev) => ({ ...prev, [item.key]: e.target.value }))}
                    />
                  </label>
                  {!hasAltText && (
                    <p className="media-row__hint">
                      Alt text is required before this photo can be published.
                    </p>
                  )}

                  <div className="media-row__actions">
                    <button
                      type="button"
                      className="admin-save"
                      disabled={pending.has(altKey) || altText === (item.alt_text ?? '')}
                      aria-busy={pending.has(altKey)}
                      onClick={() => onSaveAltText(item)}
                    >
                      Save alt text
                    </button>

                    {item.status === 'private' ? (
                      <span className="media-row__publish-control">
                        <button
                          type="button"
                          className="admin-publish"
                          disabled={pending.has(publishKey) || !hasAltText}
                          aria-busy={pending.has(publishKey)}
                          aria-describedby={!hasAltText ? `${item.key}-publish-reason` : undefined}
                          onClick={() => onPublish(item)}
                        >
                          Publish
                        </button>
                        {!hasAltText && (
                          <span className="media-row__publish-reason" id={`${item.key}-publish-reason`}>
                            Add alt text first
                          </span>
                        )}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="admin-save"
                        disabled={pending.has(unpublishKey)}
                        aria-busy={pending.has(unpublishKey)}
                        onClick={() => onUnpublish(item)}
                      >
                        Unpublish
                      </button>
                    )}

                    <button
                      type="button"
                      className="admin-remove"
                      disabled={pending.has(deleteKey)}
                      aria-busy={pending.has(deleteKey)}
                      onClick={() => onDelete(item)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
