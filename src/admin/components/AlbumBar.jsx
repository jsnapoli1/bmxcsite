import { useState } from 'react';
import { createAlbum } from '../lib/api.js';

/**
 * Album filter and creation.
 *
 * "All" is always first and always available: an album is a filter over
 * one library, not a separate library, and a director must never have to
 * guess which album a photo landed in to find it again.
 */
export default function AlbumBar({ albums, selected, onSelect, onCreated }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate(event) {
    event.preventDefault();
    if (title.trim() === '') return;
    setBusy(true);
    setError(null);
    try {
      await createAlbum({ title });
      setTitle('');
      onCreated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="album-bar">
      <div className="album-bar__filters" role="group" aria-label="Filter by album">
        <button
          type="button"
          className={selected === null ? 'album-chip album-chip--active' : 'album-chip'}
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
        >
          All
        </button>
        {albums.map((album) => (
          <button
            key={album.id}
            type="button"
            className={selected === album.id ? 'album-chip album-chip--active' : 'album-chip'}
            aria-pressed={selected === album.id}
            onClick={() => onSelect(album.id)}
          >
            {album.title} <span className="album-chip__count">{album.item_count}</span>
          </button>
        ))}
      </div>

      <form className="album-bar__create" onSubmit={handleCreate}>
        <label className="admin-field">
          New album
          <input
            type="text"
            name="albumTitle"
            value={title}
            placeholder="Session 1"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <button type="submit" className="admin-add" disabled={busy || title.trim() === ''}>
          Add album
        </button>
      </form>

      {error && <p className="admin-error" role="alert">{error}</p>}
    </div>
  );
}
