/**
 * The half of the vedit integration that imports the library, split from
 * visual-editor.jsx so the bare `vedit` import sits behind a dynamic import
 * that only a confirmed designer's session ever reaches. A visitor never
 * downloads the editor bundle.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { VeditProvider, httpAdapter, useVeditEditing } from 'vedit';
import { EDITABLE_PAGES } from './visual-editor.jsx';
import './edit-page-button.css';

/**
 * Talks to worker/routes/vedit.js.
 *
 * `staged: true` switches on Save draft / Publish / History. It is the
 * reason the schema carries two stages: without it every save would be
 * immediately live, and there would be no way to work on a page's design
 * across a few sittings without visitors watching it change underneath
 * them.
 *
 * Uploads reuse the existing media endpoint rather than adding a parallel
 * one — it already writes to R2, records the row, and stamps the uploader.
 * Note it requires the `media` permission, so a design-only editor can
 * restyle and rewrite but cannot introduce new images; that is a reasonable
 * default, and widening it is a permission grant rather than a code change.
 */
const adapter = httpAdapter({
  endpoint: '/api/admin/vedit',
  uploadEndpoint: '/api/admin/media',
  staged: true,
});

/**
 * The way into the editor: a button, plus `?vedit=1` on arrival.
 *
 * A button rather than a keyboard shortcut, because no chord turned out to
 * be safe. vedit binds ⌘E and offers no prop to change it; Chromium takes
 * ⌘E for the extensions menu; Arc takes both ⌘⇧E and ⌃⇧E for Easel. Each
 * one is swallowed by the browser before the page sees it, and a shortcut
 * the browser eats is indistinguishable from a broken feature.
 *
 * Worth recording why that took two tries to find: driving keystrokes
 * through the DevTools protocol injects them straight into the page and
 * bypasses browser-level bindings entirely, so a reserved chord tests clean
 * and fails in someone's hands. A visible control has no such gap between
 * what the test exercises and what a person does.
 *
 * ⌘⇧E is still bound below. It costs nothing, works in browsers that leave
 * it alone, and is no longer the only way in if a browser doesn't.
 *
 * Toggling through `useVeditEditing` is the library's own documented hook
 * for driving the editor from your own chrome, so nothing here reaches past
 * the public API or has to be revisited when vedit updates.
 */
function EditorLauncher() {
  const [editing, setEditing] = useVeditEditing();

  // Open straight away when someone arrives asking for the editor. They
  // said what they came for in the URL; making them press a button as well
  // is a step with no decision in it.
  //
  // Top window only. The canvas loads artboards at their own paths, so a
  // frame should never see `?vedit=1` — but if one ever did, it would open
  // an editor inside an artboard of the editor, which is a confusing state
  // to debug and cheap to rule out here.
  useEffect(() => {
    if (window.top !== window.self) return;
    if (new URLSearchParams(window.location.search).has('vedit')) {
      setEditing(true);
    }
    // Mount only: re-running on `editing` would reopen the editor every
    // time it was closed, since the query string is still there.
  }, [setEditing]);

  useEffect(() => {
    const onKeyDown = (event) => {
      // event.code, not event.key: with Shift held, `key` is layout- and
      // modifier-dependent, so matching on it misses on some keyboards.
      if (!event.shiftKey || event.code !== 'KeyE') return;
      if (!(event.metaKey || event.ctrlKey)) return;

      // Both modifiers at once is a different chord, and on Windows
      // Ctrl+Alt is AltGr — neither should toggle the editor.
      if (event.altKey) return;

      event.preventDefault();
      setEditing(!editing);
    };

    // The canvas loads each page into a same-origin iframe, and those frames
    // run this app too — so once a click lands on an artboard, keystrokes go
    // to the frame's document and never reach a listener on the top window.
    // Without this the shortcut opens the editor but cannot close it again.
    //
    // A framed copy delegates rather than toggling: its provider is its own
    // React tree, so flipping `editing` there would do nothing to the editor
    // the person is actually looking at. Re-dispatching to the top window
    // lets the outer instance — the one that owns the editor — handle it.
    const framed = window.top !== window.self;
    if (framed) {
      const relay = (event) => {
        if (!event.shiftKey || event.code !== 'KeyE') return;
        if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
        event.preventDefault();
        try {
          window.top.dispatchEvent(new KeyboardEvent('keydown', {
            key: event.key,
            code: event.code,
            metaKey: event.metaKey,
            ctrlKey: event.ctrlKey,
            shiftKey: event.shiftKey,
          }));
        } catch {
          // Cross-origin top window. Not reachable in this app — the canvas
          // frames the same site — but a thrown SecurityError here would
          // take out the page, and a shortcut is never worth that.
        }
      };
      window.addEventListener('keydown', relay);
      return () => window.removeEventListener('keydown', relay);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editing, setEditing]);

  // Inside an artboard frame this component is a relay and nothing more —
  // rendering a second button into every framed copy would put ten of them
  // on the canvas.
  if (window.top !== window.self) return null;

  return (
    <button
      type="button"
      className="edit-page-button"
      data-editing={editing ? 'true' : 'false'}
      onClick={() => setEditing(true)}
    >
      <span className="edit-page-button__dot" aria-hidden="true" />
      Edit page
    </button>
  );
}

export default function VeditRoot({ children }) {
  // One document per route. Explicit rather than relying on the default
  // (window.location.pathname), because this is a client-routed SPA: on a
  // client-side navigation the default is read once at mount and would keep
  // the first route's key for the rest of the session, quietly saving one
  // page's edits onto another's document.
  const { pathname } = useLocation();

  return (
    <VeditProvider
      documentKey={pathname}
      adapter={adapter}
      pages={EDITABLE_PAGES}
    >
      <EditorLauncher />
      {children}
    </VeditProvider>
  );
}
