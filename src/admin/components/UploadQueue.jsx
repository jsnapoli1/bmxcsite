import { useRef, useState } from 'react';
import { uploadMedia, setMediaAlbum } from '../lib/api.js';

/**
 * Uploads several files, one request at a time.
 *
 * Sequential rather than parallel: these are camp photographs straight off
 * a phone, often several megabytes each, and a dozen concurrent uploads on
 * a venue's wifi is how you get a handful of opaque failures instead of a
 * slow but complete run.
 *
 * One file failing does not abandon the rest — each row carries its own
 * state, so a director can see which three of twenty need retrying rather
 * than being told "upload failed" and starting over.
 */
export default function UploadQueue({ onUploaded, albumId = null }) {
  const [queue, setQueue] = useState([]);
  const [running, setRunning] = useState(false);
  const inputRef = useRef(null);

  function update(index, patch) {
    setQueue((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function handleFiles(event) {
    const files = [...(event.target.files ?? [])];
    if (files.length === 0) return;

    setQueue(files.map((file) => ({ name: file.name, state: 'waiting', error: null })));
    setRunning(true);

    for (let index = 0; index < files.length; index += 1) {
      update(index, { state: 'uploading' });
      try {
        // eslint-disable-next-line no-await-in-loop -- sequential on purpose
        const { media } = await uploadMedia(files[index]);
        // Placing into the album is a second call rather than an upload
        // parameter: storeUpload deliberately takes nothing that could
        // affect where a row lands, and that is worth keeping.
        // eslint-disable-next-line no-await-in-loop -- sequential on purpose
        if (albumId !== null) await setMediaAlbum(media.key, albumId);
        update(index, { state: 'done' });
      } catch (err) {
        update(index, { state: 'failed', error: err.message });
      }
    }

    setRunning(false);
    // Clear the input so choosing the same files again still fires a
    // change event — the browser treats an identical selection as a no-op.
    if (inputRef.current) inputRef.current.value = '';
    onUploaded?.();
  }

  const done = queue.filter((row) => row.state === 'done').length;
  const failed = queue.filter((row) => row.state === 'failed').length;

  return (
    <div className="upload-queue">
      <label className="admin-upload">
        <span>{running ? 'Uploading…' : 'Choose photos or videos'}</span>
        <input
          ref={inputRef}
          name="files"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,video/mp4"
          disabled={running}
          onChange={handleFiles}
        />
      </label>

      {queue.length > 0 && (
        <>
          <p className="upload-queue__summary" aria-live="polite">
            {done} of {queue.length} uploaded
            {failed > 0 ? `, ${failed} failed` : ''}
            {running ? '' : '. Everything uploaded is private until you publish it.'}
          </p>
          <ul className="upload-queue__list">
            {queue.map((row, index) => (
              // Keyed by position, not filename: two files chosen at once
              // can share a name, and a duplicate key would drop a row.
              // The list is replaced wholesale per selection, never
              // reordered, so position is stable for its lifetime.
              // eslint-disable-next-line react/no-array-index-key
              <li key={index} className={`upload-queue__row upload-queue__row--${row.state}`}>
                <span className="upload-queue__name">{row.name}</span>
                <span className="upload-queue__state">
                  {row.state === 'failed' ? row.error : row.state}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
