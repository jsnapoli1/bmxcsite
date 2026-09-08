import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { usePending } from '../../src/admin/lib/use-pending.js';

/**
 * `usePending` guards every write in the admin panel — Save, Publish, and the
 * per-row Deletes — so what matters is that a second call while the first is
 * in flight does nothing, and that a failed call still releases its key.
 *
 * The hook is captured out of a server render rather than re-implemented
 * here: a stubbed copy would pass while the real thing drifted. Every test in
 * this repo runs in the Cloudflare Workers pool, which has no jsdom, and
 * `renderToStaticMarkup` is enough to run a hook that only uses `useState`,
 * `useRef` and `useCallback`.
 *
 * The behaviour under test is the ref-and-finally logic. The guard reads a
 * ref rather than the `pending` state on purpose: state updates are batched,
 * so a flag set inside an updater is not reliably readable on the next line,
 * and a stale closure over `pending` would let a double click through.
 */
function capture() {
  let api = null;
  function Probe() {
    api = usePending();
    return null;
  }
  renderToStaticMarkup(<Probe />);
  return api;
}

describe('usePending', () => {
  it('runs the work and resolves with its result', async () => {
    const api = capture();
    const work = vi.fn(async () => 'done');

    await expect(api.run('save', work)).resolves.toBe('done');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('ignores a second call while the first is still in flight', async () => {
    const api = capture();
    let release;
    const work = vi.fn(() => new Promise((resolve) => { release = resolve; }));

    const first = api.run('save', work);
    // Fired before the first resolves — a double click on Save.
    await expect(api.run('save', work)).resolves.toBeUndefined();
    expect(work).toHaveBeenCalledTimes(1);

    release('done');
    await first;

    // ...and the action is available again once it finishes.
    await expect(api.run('save', async () => 'again')).resolves.toBe('again');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('releases the key when the work throws, so the button is not stuck', async () => {
    const api = capture();

    await expect(api.run('publish', async () => { throw new Error('nope'); }))
      .rejects.toThrow('nope');

    // The `finally` is the whole point: without it a failed save would
    // disable its button until the page was reloaded.
    await expect(api.run('publish', async () => 'ok')).resolves.toBe('ok');
  });

  it('keys are independent, so one row deleting does not disable another', async () => {
    const api = capture();
    let release;
    const first = api.run('delete:ken-crawford', () => new Promise((r) => { release = r; }));

    await expect(api.run('delete:sarah-schnitter', async () => 'ok')).resolves.toBe('ok');

    release('ok');
    await first;
  });
});
