/**
 * The half of the vedit integration that imports the library, split from
 * visual-editor.jsx so the bare `vedit` import sits behind a dynamic import
 * that only a confirmed designer's session ever reaches. A visitor never
 * downloads the editor bundle.
 */
import { useLocation } from 'react-router-dom';
import { VeditProvider, httpAdapter } from 'vedit';
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
      {children}
    </VeditProvider>
  );
}
