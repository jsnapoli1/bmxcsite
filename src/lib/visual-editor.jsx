/**
 * vedit (https://github.com/jsnapoli1/vedit) — the visual editor.
 *
 * There are two paths through this file, and the distinction matters:
 *
 * - **Visitors** get a provider that renders published overrides but cannot
 *   open the editor. This is not optional: `<Editable>` throws outside a
 *   provider, and overrides are applied by the provider, so a page rendered
 *   without one is a blank screen rather than a slightly-plainer page.
 * - **Designers** (admins holding the `design` permission, and anyone in
 *   development) get the editor itself on top, on Cmd+E. In production,
 *   open the site once with `?vedit=1` to ask for it; the answer is
 *   remembered for the tab. Visitors never make that request at all.
 *
 * The reader is imported statically and the editor lazily. That asymmetry
 * is deliberate. An earlier version lazy-loaded both and rendered
 * `children` as the Suspense fallback, which put every `<Editable>` in the
 * Navbar and Footer on screen for one paint with no provider above them —
 * the whole site rendered blank with "Vedit components must be rendered
 * inside <VeditProvider>". A provider a visitor always needs cannot be
 * behind a boundary that renders without it.
 *
 * `enabled` decides whether the editor UI opens. It protects nothing on its
 * own — a determined visitor can flip a client-side flag. The real
 * guarantee is `requireArea('design')` plus the `authorize` callback in
 * worker/routes/vedit.js, which is what rejects a write.
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import VeditReader from './visual-editor-reader.jsx';
import {
  VEDIT_SESSION_KEY,
  VEDIT_OPEN_KEY,
  EDITABLE_PAGES,
} from './visual-editor-pages.js';

const VeditEditor = lazy(() => import('./visual-editor-provider.jsx'));

// Constants live in their own module so the admin panel can import them
// without pulling this file — and the lazy editor import below — into its
// bundle. Re-exported here so the editor's own modules have one import.
export { VEDIT_SESSION_KEY, VEDIT_OPEN_KEY, EDITABLE_PAGES };

/**
 * Whether this visitor may open the editor.
 *
 * The check is skipped entirely in development — asking /api/admin/me
 * against a local wrangler with no Access session in front of it would
 * answer 403 and lock the editor out of the environment it is most used in.
 *
 * In production it runs once and fails closed: any failure (403, offline,
 * expired session, the HTML login page Access serves on an expired
 * session) leaves the editor shut. A visitor who cannot be confirmed as a
 * designer is treated as not one.
 */
function useDesignAccess() {
  const [allowed, setAllowed] = useState(import.meta.env.DEV);

  useEffect(() => {
    if (import.meta.env.DEV) return undefined;

    // Don't ask at all unless someone came here to edit. The probe is only
    // useful to the handful of people who can, and running it on every page
    // load spends a request on thousands of visitors who never will.
    //
    // The signal is set by the admin panel's Design page and lives in
    // sessionStorage: it survives the navigation out of /admin, lasts the
    // tab, and — unlike the `?vedit=1` it replaces — cannot be produced by
    // typing a URL. That matters less than it sounds, since the permission
    // check is what actually gates the editor, but a signal nobody can
    // guess keeps the probe off visitors entirely.
    if (sessionStorage.getItem(VEDIT_SESSION_KEY) !== '1') return undefined;

    // Guards against setting state after unmount.
    let active = true;

    // `redirect: 'manual'` matters in production. Cloudflare Access answers
    // an unauthenticated /api/admin/* with a 302 to a login page on
    // cloudflareaccess.com; following it cross-origin fails CORS and logs
    // two red errors in every visitor's console. Left manual, the redirect
    // comes back as an opaque response — not `ok`, so it falls through to
    // "not a designer" exactly as a 403 would, silently.
    fetch('/api/admin/me', {
      headers: { accept: 'application/json' },
      redirect: 'manual',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        // `isAdmin ||` mirrors hasPermission() on the server, which
        // short-circuits on admin before it ever looks at the permission
        // columns. Checking `permissions.design` alone asks a different
        // question than the server answers: an admin with can_design = 0
        // is allowed to write and was shown no way to start.
        if (!active || !body) return;
        if (body.isAdmin === true || body.permissions?.design === true) {
          setAllowed(true);
        }
      })
      .catch(() => {
        // Deliberately silent. A visitor is not an editor, and reporting a
        // failed permission probe is noise on a site mostly read by parents
        // and athletes.
      });

    return () => { active = false; };
  }, []);

  return allowed;
}

export default function VisualEditor({ children }) {
  const allowed = useDesignAccess();

  if (!allowed) return <VeditReader>{children}</VeditReader>;

  // The reader is the fallback, not `children`: it keeps a provider above
  // the tree for the paint or two before the editor chunk lands, so the
  // page shows its published design throughout rather than flashing or
  // throwing.
  return (
    <Suspense fallback={<VeditReader>{children}</VeditReader>}>
      <VeditEditor>{children}</VeditEditor>
    </Suspense>
  );
}
