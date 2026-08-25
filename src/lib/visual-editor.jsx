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

const VeditEditor = lazy(() => import('./visual-editor-provider.jsx'));

/** Every route the editor offers as an artboard on its canvas. */
export const EDITABLE_PAGES = [
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
];

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

    // Don't ask at all unless someone signals they want the editor. The
    // probe is only useful to the handful of people who can edit, and
    // running it on every page load spends a request on thousands of
    // visitors who never will. `?vedit=1` (or a previous opt-in remembered
    // in sessionStorage) is the signal.
    const wants = new URLSearchParams(window.location.search).has('vedit')
      || sessionStorage.getItem('vedit:probe') === '1';
    if (!wants) return undefined;
    sessionStorage.setItem('vedit:probe', '1');

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
        if (active && body?.permissions?.design === true) setAllowed(true);
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
