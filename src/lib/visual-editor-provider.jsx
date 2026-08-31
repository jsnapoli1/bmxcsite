/**
 * The half of the vedit integration that imports the library, split from
 * visual-editor.jsx so the bare `vedit` import sits behind a dynamic import
 * that only a confirmed designer's session ever reaches. A visitor never
 * downloads the editor bundle.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { VeditProvider, httpAdapter, useVeditEditing } from 'vedit';
import { EDITABLE_PAGES, VEDIT_OPEN_KEY } from './visual-editor-pages.js';
import { components } from './vedit-components.js';
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
/**
 * vedit's default scanner selector, minus SplitText's internals.
 *
 * The default matches `span`, and treats any childless element holding text
 * as its own editable node. SplitText puts every word in its own span (three
 * deep per word, for the staggered reveal), so a six-word headline arrived as
 * ~18 selectable one-word boxes.
 *
 * Excluding them here rather than marking them `data-vedit-ui` is the
 * difference between "not independently selectable" and "not clickable at
 * all": vedit uses that attribute for its own chrome and tests it with
 * `closest()`, so marking the words made the whole heading unselectable —
 * the click matched an ancestor and returned before reaching the
 * `<Editable>` wrapping the line.
 *
 * Kept in step with DEFAULT_AUTO_SELECTOR in vedit; if that gains a tag,
 * this list needs it too.
 */
const SPLIT_TEXT_PARTS = ':not(.split-text__word):not(.split-text__inner):not(.split-text__space)';

const AUTO_SELECTOR = [
  'h1,h2,h3,h4,h5,h6,p,a,li,dt,dd,blockquote,figcaption,td,th,label,button',
  `span${SPLIT_TEXT_PARTS}`,
  'img,svg,picture,video,canvas,figure',
  'div,section,article,header,footer,main,aside,nav,form,ul,ol,dl,table,pre',
].join(',');

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

  // Open straight away for someone who arrived from the admin panel's
  // Design page. They already picked a page and pressed a link that said
  // "edit"; making them press a second button here is a step with no
  // decision in it.
  //
  // The flag is cleared as soon as it is read, so it opens the editor once
  // rather than on every subsequent navigation in the tab. Closing the
  // editor and clicking around the site then behaves normally, and the
  // button stays available for reopening.
  //
  // Top window only: a framed artboard reading this would open an editor
  // inside an artboard of the editor.
  useEffect(() => {
    if (window.top !== window.self) return;
    const params = new URLSearchParams(window.location.search);
    const askedByUrl = params.has('edit');
    const askedByFlag = sessionStorage.getItem(VEDIT_OPEN_KEY) === '1';

    if (!askedByUrl && !askedByFlag) {
      // Reached when the editor chunk loads but nothing asked it to open —
      // e.g. the signal was consumed by an earlier mount, or the page was
      // reached by ordinary navigation. The button is still there.
      console.info('[vedit] editor ready — press Edit page to open it');
      return;
    }

    console.info(
      `[vedit] opening (${askedByUrl ? '?edit=1' : 'session flag'})`,
    );

    // Consumed, not cleared wholesale: the session flag that keeps the
    // button available for the rest of the tab is a separate key.
    try {
      sessionStorage.removeItem(VEDIT_OPEN_KEY);
    } catch {
      // Storage unavailable; the URL signal already carried this open.
    }

    // Take `?edit=1` out of the address bar once it has been read, so
    // reloading doesn't reopen the editor and the URL isn't shareable in a
    // way that implies it grants something.
    if (askedByUrl) {
      params.delete('edit');
      const query = params.toString();
      window.history.replaceState(
        null,
        '',
        window.location.pathname + (query ? `?${query}` : '') + window.location.hash,
      );
    }

    setEditing(true);
  }, [setEditing]);

  // Says whether the editor actually came up, separately from being asked
  // to. A provider that mounts but never flips to editing looks identical
  // from outside to one that was never asked.
  useEffect(() => {
    console.info(`[vedit] editing = ${editing}`);
  }, [editing]);

  // vedit loads its editor UI with a bare `void import(...).then(...)` and
  // no catch (EditorHost, chunk-TTKFO6QU). If that import fails — a chunk
  // that 404s behind a stale HTML cache, a CSP that blocks it, an offline
  // moment — the rejection is unhandled, its `Editor` state stays null, and
  // it renders null forever. `editing` is true the whole time, so from
  // outside it is indistinguishable from the editor simply not appearing,
  // with nothing in the console.
  //
  // This listener cannot repair that, but it makes it audible. Remove it
  // once vedit catches its own import failure.
  useEffect(() => {
    const onRejection = (event) => {
      const message = String(event.reason?.message ?? event.reason ?? '');
      if (/mount-|dynamically imported module|Importing a module/i.test(message)) {
        console.error(
          '[vedit] the editor UI chunk failed to load — the editor cannot '
          + 'render. Usually a stale cached page pointing at a chunk that no '
          + 'longer exists: hard-reload (Cmd+Shift+R). Original error:',
          event.reason,
        );
      }
    };
    window.addEventListener('unhandledrejection', onRejection);
    return () => window.removeEventListener('unhandledrejection', onRejection);
  }, []);

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
      onClick={() => {
        // Logged at the click so a report can distinguish three cases that
        // otherwise look identical: the click never fired, it fired but
        // `editing` never flipped, or it flipped and the UI still didn't
        // render (vedit's chunk load failing — see the rejection listener
        // above). Only the third is vedit's bug; the first two would be
        // this button's.
        console.info('[vedit] Edit page clicked');
        setEditing(true);
      }}
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
      autoSelector={AUTO_SELECTOR}
      components={components}
      // Required, not optional. Without it vedit falls back to
      // defaultEnabled(), which is true only on localhost, in a
      // NODE_ENV=development build, or with `?vedit=1` in the URL — none of
      // which hold on bmxc.camp. It then renders no EditorHost at all,
      // while `useVeditEditing` keeps working because it only writes to the
      // store: `editing` flips to true, the store agrees the editor is
      // open, and nothing appears. Silent, and invisible on localhost,
      // where the fallback happens to return true.
      //
      // This component is only ever mounted for someone who already passed
      // the permission check in visual-editor.jsx, so `true` is the whole
      // condition. The server still authorizes every write independently.
      enabled
    >
      <EditorLauncher />
      {children}
    </VeditProvider>
  );
}
