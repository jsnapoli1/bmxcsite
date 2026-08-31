/**
 * The routes the visual editor can open, and the flags that hand a session
 * from the admin panel to the public site.
 *
 * Split out from visual-editor.jsx so the admin panel can import them
 * without dragging the editor in behind them. That file holds the lazy
 * `import('./visual-editor-provider.jsx')`, and Rollup follows the import
 * even when the branch that reaches it is unreachable from /admin — so the
 * admin bundle ended up referencing an editor chunk it never renders.
 *
 * Data and constants only. Nothing here may import React or the editor.
 */

/**
 * Two flags, because the admin panel's link is really saying two things with
 * different lifetimes.
 *
 * `VEDIT_SESSION_KEY` — "this person is here to edit", for the rest of the
 * tab. It is what allows the permission probe to run at all, so it has to
 * outlive the first page: closing the editor and clicking to another route
 * must not lose the button.
 *
 * `VEDIT_OPEN_KEY` — "open the editor now", consumed once. Without the
 * split, opening the editor would either happen on every navigation for the
 * rest of the tab, or clearing it would take the session flag with it and
 * revoke the button after one page.
 *
 * sessionStorage rather than a query string: it survives the hop out of
 * /admin, is scoped to the tab, and leaves no shareable URL that looks like
 * it grants something. Neither flag grants anything on its own — setting
 * them by hand only earns you a permission check you will fail.
 */
export const VEDIT_SESSION_KEY = 'vedit:session';
export const VEDIT_OPEN_KEY = 'vedit:open';

/** Every route the editor can open, and the admin panel offers. */
export const EDITABLE_PAGES = Object.freeze([
  { path: '/', label: 'Home' },
  { path: '/camp', label: 'Camp' },
  { path: '/playlists', label: 'Playlists' },
  { path: '/videos', label: 'Videos' },
  { path: '/merch', label: 'Merch' },
  { path: '/staff', label: 'Staff' },
  { path: '/faq', label: 'FAQ' },
  { path: '/blog', label: 'Blog' },
  { path: '/registration', label: 'Registration' },
  { path: '/contact', label: 'Contact' },
]);
