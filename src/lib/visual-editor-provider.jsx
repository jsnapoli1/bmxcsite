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
 * Opens the editor on ⌘⇧E (Ctrl+⇧E), and on arrival with `?vedit=1`.
 *
 * vedit binds ⌘E itself and offers no prop to change it, but Chromium
 * browsers take ⌘E for the extensions menu — so the library's own shortcut
 * never reaches the page in the browser most people here use. Adding Shift
 * clears that binding (and Safari's, and Firefox's) while keeping the "E
 * for editor" mnemonic one modifier from what the vedit docs describe.
 *
 * This is additive: ⌘E still works wherever the browser leaves it alone.
 * Toggling through `useVeditEditing` is the library's own documented hook
 * for driving the editor from your own chrome, so nothing here reaches past
 * the public API or has to be revisited when vedit updates.
 */
function EditorShortcut() {
  const [editing, setEditing] = useVeditEditing();

  // Open straight away when someone arrives asking for the editor. They
  // said what they came for in the URL; making them press a key as well is
  // a step with no decision in it.
  useEffect(() => {
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

  return null;
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
      <EditorShortcut />
      {children}
    </VeditProvider>
  );
}
