import { useEffect, useState } from 'react';
import { getMe } from './lib/api.js';
import Users from './pages/Users.jsx';
import Staff from './pages/Staff.jsx';
import Faq from './pages/Faq.jsx';
import Merch from './pages/Merch.jsx';
import Media from './pages/Media.jsx';
import Blog from './pages/Blog.jsx';
import Design from './pages/Design.jsx';
import Store from './pages/Store.jsx';
// CampInfo.jsx is intentionally not imported here — see the PAGES comment
// below for why the tab stays hidden.

/**
 * Every editor page keyed by nav id, alongside the permission that unlocks
 * it. staff, faq, and campinfo all share the `campinfo` permission — that
 * mapping lives on the server (worker/routes/content.js) and is mirrored
 * here only to decide what to show, never to enforce access.
 *
 * `campinfo` is deliberately left out of this list. The editor
 * (src/admin/pages/CampInfo.jsx) and its API are complete and tested, but
 * no public page reads the `campinfo` content area yet — Camp.jsx, Home.jsx,
 * and Contact.jsx still read the static CAMP object from src/data/camp.js.
 * Showing the tab would let a director publish changes and be told "The
 * public site now shows this" when it does not, which is worse than the
 * feature not being there. Add it back once a page actually consumes
 * `campinfo` (see src/hooks/useContent.js for the pattern staff/faq/merch
 * already use).
 */
const PAGES = [
  { id: 'staff', label: 'Staff', permission: 'campinfo', Component: Staff },
  { id: 'faq', label: 'Questions & answers', permission: 'campinfo', Component: Faq },
  { id: 'merch', label: 'Merch', permission: 'merch', Component: Merch },
  // The online store, served by a separate OpenShop worker and proxied
  // through worker/routes/shop.js. Shares the `merch` permission with the
  // tab above: same person, same area, different backend.
  { id: 'store', label: 'Store', permission: 'merch', Component: Store },
  { id: 'media', label: 'Photos & videos', permission: 'media', Component: Media },
  { id: 'blog', label: 'Blog', permission: 'blog', Component: Blog },
  // Not an editor itself — a list of links into the visual editor, which
  // lives on the public site because it edits those pages in place.
  { id: 'design', label: 'Site design', permission: 'design', Component: Design },
];

export default function AdminApp() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);
  const [activePage, setActivePage] = useState(null);
  // Drawer state, and only meaningful under 48rem — the sidebar layout
  // ignores it entirely. Selecting a section closes it, since on a phone
  // the nav covers the thing you just asked to see.
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    getMe().then(setMe).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <main className="admin-shell">
        <h1>Admin</h1>
        <p className="admin-notice">
          We could not confirm your access. Try reloading the page.
        </p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="admin-shell">
        <p className="admin-notice" aria-busy="true">Loading…</p>
      </main>
    );
  }

  if (!me.registered) {
    return (
      <main className="admin-shell">
        <h1>Admin</h1>
        <p className="admin-notice">
          You are signed in as <strong>{me.email}</strong>, but you have not
          been given access to anything yet. Ask a camp director to add you.
        </p>
      </main>
    );
  }

  // Only the areas this signed-in person may edit are offered. The server
  // enforces this independently on every request (worker/routes/content.js
  // and worker/routes/users.js), so hiding a tab here is a usability
  // courtesy, not the access control.
  const availablePages = PAGES.filter(
    (page) => me.isAdmin || me.permissions[page.permission],
  );
  const navItems = [
    ...(me.isAdmin ? [{ id: 'people', label: 'People' }] : []),
    ...availablePages.map((page) => ({ id: page.id, label: page.label })),
  ];

  const selected = activePage && navItems.some((item) => item.id === activePage)
    ? activePage
    : navItems[0]?.id ?? null;

  const activeContentPage = availablePages.find((page) => page.id === selected);

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header__bar">
          <h1>Admin</h1>
          {navItems.length > 1 && (
            <button
              type="button"
              className="admin-nav__toggle"
              aria-expanded={navOpen}
              aria-controls="admin-nav"
              onClick={() => setNavOpen((open) => !open)}
            >
              {navOpen ? 'Close' : 'Sections'}
            </button>
          )}
        </div>
        <p className="admin-identity">
          Signed in as {me.name ?? me.email}
          {me.isAdmin ? ' · Administrator' : ''}
        </p>
      </header>

      <div className="admin-layout">
        {navItems.length > 1 && (
          <nav
            id="admin-nav"
            className={navOpen ? 'admin-nav admin-nav--open' : 'admin-nav'}
            aria-label="Admin sections"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.id === selected ? 'admin-nav__link admin-nav__link--active' : 'admin-nav__link'
                }
                aria-current={item.id === selected ? 'page' : undefined}
                onClick={() => { setActivePage(item.id); setNavOpen(false); }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}

        <main className="admin-main">
          {!selected && (
            <p className="admin-notice">
              You have not been given anything to edit yet. Ask a camp director
              to add you to an area.
            </p>
          )}

          {selected === 'people' && me.isAdmin && <Users currentEmail={me.email} />}
          {activeContentPage && <activeContentPage.Component key={activeContentPage.id} />}
        </main>
      </div>
    </div>
  );
}
