import { useEffect, useState } from 'react';
import { getMe } from './lib/api.js';
import Users from './pages/Users.jsx';
import Staff from './pages/Staff.jsx';
import Faq from './pages/Faq.jsx';
import Merch from './pages/Merch.jsx';
import Media from './pages/Media.jsx';
import Blog from './pages/Blog.jsx';
import Design from './pages/Design.jsx';
import Email from './pages/Email.jsx';
import Faces from './pages/Faces.jsx';
import Registrations from './pages/Registrations.jsx';
import Store from './pages/Store.jsx';
import { Busy, Failure } from './components/States.jsx';
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
  // Staff @bmxc.camp forwarding addresses and the subscriber list. Under
  // `campinfo` because handing someone a camp address is camp
  // administration, which that permission already covers.
  // Who is coming to camp. Its own permission — guardians' contact
  // details and children's names, not site copy.
  { id: 'registrations', label: 'Registrations', permission: 'registrations', Component: Registrations },
  { id: 'email', label: 'Email', permission: 'campinfo', Component: Email },
  { id: 'merch', label: 'Merch', permission: 'merch', Component: Merch },
  // The online store, served by a separate OpenShop worker and proxied
  // through worker/routes/shop.js. Shares the `merch` permission with the
  // tab above: same person, same area, different backend.
  { id: 'store', label: 'Store', permission: 'merch', Component: Store },
  { id: 'media', label: 'Photos & videos', permission: 'media', Component: Media },
  // The camp roster and its consent record. Its own permission, not
  // `media`: tagging asserts that a named child is in a photograph.
  { id: 'faces', label: 'Face tagging', permission: 'faces', Component: Faces },
  { id: 'blog', label: 'Blog', permission: 'blog', Component: Blog },
  // Not an editor itself — a list of links into the visual editor, which
  // lives on the public site because it edits those pages in place.
  { id: 'design', label: 'Site design', permission: 'design', Component: Design },
];

/**
 * The camp's mark and wordmark, the same brand block the public site opens
 * with. Rendered on every path the panel can take — including the loading,
 * signed-out and no-access states, which previously showed a bare serif
 * "Admin" over a hairline and did not look like this site at all.
 *
 * `bandRight` is what sits opposite the brand on the band itself (identity
 * and the drawer toggle); `children` is the page beneath it.
 */
function Masthead({ children, bandRight }) {
  return (
    <>
      <header className="admin-header">
        {/* The masthead spans the viewport; this inner element holds its
            contents to the same measure as the page body below it. */}
        <div className="admin-header__bar admin-measure">
          <a className="admin-brand" href="/">
            <img
              className="admin-brand__mark"
              src="/bmxc-logo.png"
              alt=""
              width="40"
              height="40"
            />
            <span className="admin-brand__wordmark">
              <span className="admin-brand__name">BMXC</span>
              <span className="admin-brand__sub">Est. 1969</span>
            </span>
          </a>
          {bandRight}
        </div>
      </header>
      {children}
    </>
  );
}

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

  // The three pre-panel states share the masthead, so a signed-out or
  // still-loading page is recognisably the same site rather than an
  // unstyled paragraph on blank paper.
  if (error) {
    return (
      <Masthead>
        <main className="admin-shell admin-measure">
          <Failure message="We could not confirm your access. Try reloading the page." />
        </main>
      </Masthead>
    );
  }

  if (!me) {
    return (
      <Masthead>
        <main className="admin-shell admin-measure">
          <Busy />
        </main>
      </Masthead>
    );
  }

  if (!me.registered) {
    return (
      <Masthead>
        <main className="admin-shell admin-measure">
          <p className="admin-notice">
            You are signed in as <strong>{me.email}</strong>, but you have not
            been given access to anything yet. Ask a camp director to add you.
          </p>
        </main>
      </Masthead>
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
    <Masthead
      bandRight={
        <div className="admin-header__right">
          <p className="admin-identity">
            {me.name ?? me.email}
            {me.isAdmin && <span className="admin-identity__role">Administrator</span>}
          </p>
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
      }
    >
      <div className="admin-shell admin-layout admin-measure">
        {navItems.length > 1 && (
          <nav
            id="admin-nav"
            className={navOpen ? 'admin-nav admin-nav--open' : 'admin-nav'}
            aria-label="Admin sections"
          >
            {/* A ruled index, in the handbook language the site uses: the
                label names the column rather than leaving the list floating
                against the page. */}
            <p className="admin-nav__label" aria-hidden="true">Sections</p>
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
    </Masthead>
  );
}
