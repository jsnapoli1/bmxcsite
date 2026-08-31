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
import { Component, lazy, Suspense, useEffect, useState } from 'react';
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
/**
 * Say why the editor is or isn't available, but only to someone who asked
 * for it.
 *
 * Every branch of the permission check reports through here. Without it the
 * failure modes are indistinguishable from the outside — a missing handoff
 * flag, an expired Access session, a missing permission and a network error
 * all present identically as "no button", which is why diagnosing this took
 * several rounds of guessing.
 *
 * Visitors never reach any of these calls: the first thing the check does is
 * return when the session flag is absent, and only the admin panel sets it.
 */
function reportVeditState(message) {
  console.info(`[vedit] ${message}`);
}

function useDesignAccess() {
  // A framed copy is an artboard on someone else's canvas. It renders the
  // page for the editor to point at and must never become an editor itself:
  // the editor's own guards already stop the chrome appearing, but without
  // this each of the ten frames still ran its own permission probe and
  // mounted the full editor provider — ten redundant /api/admin/me requests
  // and ten copies of the heavy path, to render ten read-only pages.
  const framed = typeof window !== 'undefined' && window.top !== window.self;

  const [allowed, setAllowed] = useState(import.meta.env.DEV && !framed);

  useEffect(() => {
    if (framed) return undefined;
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
    // Either signal will do. The flag is the one that survives navigation
    // around the site; `?edit=1` is what the admin panel's link carries so
    // the handoff does not depend on a storage write landing before the
    // browser navigates away.
    const asked = sessionStorage.getItem(VEDIT_SESSION_KEY) === '1'
      || new URLSearchParams(window.location.search).has('edit');
    if (!asked) return undefined;

    // Promote the URL signal to the session flag so it survives the rest of
    // the tab, then take it out of the address bar — a URL that looks like
    // it grants something invites being shared, and this one does not.
    try {
      sessionStorage.setItem(VEDIT_SESSION_KEY, '1');
    } catch {
      // Storage unavailable. The editor still works for this page; only
      // the "stays available as you navigate" part is lost.
    }

    // Guards against setting state after unmount.
    let active = true;

    // `redirect: 'manual'` keeps an Access redirect from being followed
    // cross-origin to cloudflareaccess.com, which fails CORS and logs red
    // errors. The cost is that the response comes back opaque — status 0,
    // ok false — which is indistinguishable from a refusal, so the branch
    // above names it explicitly rather than letting it read as "not a
    // designer".
    //
    // `credentials: 'same-origin'` is the default, but stated because this
    // request only works at all if the CF_Authorization cookie rides along:
    // without it Access redirects, and the editor stays shut for someone
    // who is in fact signed in.
    fetch('/api/admin/me', {
      headers: { accept: 'application/json' },
      credentials: 'same-origin',
      redirect: 'manual',
    })
      .then((res) => {
        // An Access redirect answers opaque: status 0, ok false. Worth
        // naming separately from a real 403, because the fix is different
        // (sign in again vs. ask for the permission).
        if (res.type === 'opaqueredirect' || res.status === 0) {
          reportVeditState('signed out — /api/admin/me redirected to Access');
          return null;
        }
        if (!res.ok) {
          reportVeditState(`/api/admin/me answered ${res.status}`);
          return null;
        }
        return res.json();
      })
      .then((body) => {
        // `isAdmin ||` mirrors hasPermission() on the server, which
        // short-circuits on admin before it ever looks at the permission
        // columns. Checking `permissions.design` alone asks a different
        // question than the server answers: an admin with can_design = 0
        // is allowed to write and was shown no way to start.
        if (!active || !body) return;
        if (body.isAdmin === true || body.permissions?.design === true) {
          reportVeditState('ok — editor available');
          setAllowed(true);
          return;
        }
        reportVeditState(
          `no design permission for ${body.email ?? 'this account'}`,
        );
      })
      .catch((error) => {
        // Still silent for visitors — this only speaks when someone asked
        // for the editor, which a visitor never does.
        reportVeditState(`permission check failed: ${error?.message ?? error}`);
      });

    return () => { active = false; };
  }, [framed]);

  return allowed;
}

/**
 * Catches a failure to load or render the editor chunk and falls back to the
 * read-only provider, so a broken editor costs the designer their tools
 * rather than costing every visitor the page.
 *
 * A class because React has no hook equivalent. It exists mostly to make the
 * failure audible: without it, a chunk that fails to load leaves the reader
 * rendering forever, which looks exactly like a page that simply has no
 * editor and says nothing about why.
 */
class EditorLoadBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('[vedit] editor failed to load', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function VisualEditor({ children }) {
  const allowed = useDesignAccess();

  if (!allowed) return <VeditReader>{children}</VeditReader>;

  // The reader is the fallback, not `children`: it keeps a provider above
  // the tree for the paint or two before the editor chunk lands, so the
  // page shows its published design throughout rather than flashing or
  // throwing.
  // The reader is the fallback, not `children`: it keeps a provider above
  // the tree for the paint or two before the editor chunk lands, so the
  // page shows its published design throughout rather than flashing or
  // throwing.
  //
  // The boundary is local rather than vedit's own VeditErrorBoundary,
  // because importing that here would pull the library into the visitor
  // bundle — the whole reason the editor sits behind a dynamic import.
  return (
    <EditorLoadBoundary fallback={<VeditReader>{children}</VeditReader>}>
      <Suspense fallback={<VeditReader>{children}</VeditReader>}>
        <VeditEditor>{children}</VeditEditor>
      </Suspense>
    </EditorLoadBoundary>
  );
}
