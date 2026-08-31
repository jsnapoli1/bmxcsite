import {
  EDITABLE_PAGES,
  VEDIT_SESSION_KEY,
  VEDIT_OPEN_KEY,
} from '../../lib/visual-editor-pages.js';

/**
 * The way into the visual editor.
 *
 * The editor itself lives on the public site — it has to, since it edits the
 * real pages in place. What belongs here is the entry point: /admin is
 * already behind Cloudflare Access, so reaching this list means you have
 * signed in, and the link tells you where to go rather than asking you to
 * remember a URL.
 *
 * Each link opens one route. `EDITABLE_PAGES` is imported from the editor's
 * own module rather than restated, so a route added there appears here
 * without a second edit — the drift that hid the `design` permission from
 * this same panel started as exactly this kind of duplicated list.
 */
export default function Design() {
  /**
   * Tell the public site what this click meant, then let the link navigate
   * normally.
   *
   * Two flags with different lifetimes: the session one keeps the Edit page
   * button available for the rest of the tab, the open-once one opens the
   * editor on arrival and is consumed there. Set on click rather than on
   * render, so merely looking at this list doesn't arm the editor.
   *
   * sessionStorage is same-origin, and /admin is served from the same origin
   * as the site, so the flags survive the navigation.
   */
  const handoff = () => {
    try {
      sessionStorage.setItem(VEDIT_SESSION_KEY, '1');
      sessionStorage.setItem(VEDIT_OPEN_KEY, '1');
    } catch {
      // Private-mode storage limits. The link still navigates; the editor
      // just won't open by itself, which is a worse experience rather than
      // a broken one.
    }
  };

  return (
    <section className="admin-section" aria-labelledby="design-heading">
      <h2 id="design-heading">Site design</h2>

      <p className="admin-help">
        Open a page in the visual editor to rewrite its text or restyle it.
        Changes are saved as a draft and stay invisible to visitors until you
        press Publish.
      </p>

      <ul className="design-pages">
        {EDITABLE_PAGES.map((page) => (
          <li key={page.path} className="design-pages__item">
            <a
              className="design-pages__link"
              href={page.path}
              onClick={handoff}
            >
              <span className="design-pages__label">{page.label}</span>
              <span className="design-pages__path">{page.path}</span>
            </a>
          </li>
        ))}
      </ul>

      <p className="admin-help">
        The editor opens on the page you pick. Closing it returns you to that
        page on the public site; come back here to edit a different one.
      </p>
    </section>
  );
}
