import { useCallback, useRef, useState } from 'react';

/**
 * Tracks which actions are in flight, by key.
 *
 * Every editor in this panel needs the same thing: a Save button that cannot
 * be pressed twice, and a per-row Delete that disables only its own row. A
 * plain boolean cannot express the second, so this is a Set of keys —
 * `'save'`, `'publish'`, or something scoped like `delete:${slug}`.
 *
 * This existed as the same ten lines copied into five files (Staff, Faq,
 * Merch, Blog, Media). Extracted so a fix reaches all of them.
 *
 * `run` is the reason to prefer this over raw state: it holds the key for the
 * duration of the work and clears it in a `finally`, so an action that throws
 * cannot leave its button disabled forever. It returns `undefined` when the
 * key is already pending, which is also the reentrancy guard.
 */
export function usePending() {
  const [pending, setPending] = useState(() => new Set());
  // The guard reads from a ref, not from `pending`. State updates are batched
  // and the updater's timing is React's business, so a flag set inside one is
  // not reliably readable on the next line — and a stale `pending` closure
  // would let a double click through. The ref is always current.
  const inFlight = useRef(new Set());

  const mark = useCallback((key) => {
    setPending((prev) => new Set(prev).add(key));
  }, []);

  const clear = useCallback((key) => {
    setPending((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const isPending = useCallback((key) => pending.has(key), [pending]);

  const run = useCallback(async (key, work) => {
    if (inFlight.current.has(key)) return undefined;
    inFlight.current.add(key);
    mark(key);
    try {
      return await work();
    } finally {
      inFlight.current.delete(key);
      clear(key);
    }
  }, [mark, clear]);

  return { pending, mark, clear, isPending, run };
}
