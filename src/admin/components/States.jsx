/**
 * The three states every admin page passes through.
 *
 * Each page used to write its own markup for these, and it drifted: some
 * errors were announced to screen readers and some were not, and "nothing
 * here yet" was worded a different way on every page. One component each
 * keeps the vocabulary consistent and gives a new page the right behaviour
 * without having to remember the ARIA.
 */

/** A page or section waiting on the network. */
export function Busy({ label = 'Loading…' }) {
  return <p className="admin-notice" aria-busy="true">{label}</p>;
}

/**
 * A failure worth interrupting for.
 *
 * Renders nothing when there is no message: pages hold this state as null
 * most of the time, and an empty `role="alert"` box would announce a
 * failure that has not happened.
 */
export function Failure({ message }) {
  if (!message) return null;
  return <p className="admin-error" role="alert">{message}</p>;
}

/** A list with nothing in it yet. */
export function Empty({ children }) {
  return <p className="admin-notice admin-notice--empty">{children}</p>;
}
