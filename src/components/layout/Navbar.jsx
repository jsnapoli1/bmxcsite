import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Editable, EditableImage } from 'vedit';
import './navbar.css';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/camp', label: 'The Week' },
  { to: '/playlists', label: 'Playlists' },
  { to: '/videos', label: 'Videos' },
  // `external` renders a plain <a>, so the browser makes a real request the
  // Worker can answer with its redirect to shop.bmxc.camp. A <NavLink> here
  // is handled by React Router, which has no /merch route and would render
  // the 404 page — the redirect would work for a bookmark and not for the
  // nav, which is how most people reach it.
  { to: '/merch', label: 'Merch', external: true },
  { to: '/staff', label: 'Staff' },
  { to: '/faq', label: 'FAQ' },
  { to: '/blog', label: 'Blog' },
  { to: '/registration', label: 'Register' },
];

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Solidify the bar once the hero starts leaving. Passive listener + rAF
  // guard keeps this off the critical path.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 24);
        frame = 0;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => setIsMenuOpen(false), [pathname]);

  // Lock body scroll while the mobile menu owns the screen.
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMenuOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className={`navbar${isScrolled ? ' is-scrolled' : ''}${isMenuOpen ? ' is-open' : ''}`}>
      <div className="navbar__inner container-wide">
        <NavLink to="/" className="navbar__brand" aria-label="Blue Mountain XC Camp — home">
          <EditableImage
            id="chrome.navbar.mark"
            as="img"
            className="navbar__mark"
            src="/bmxc-logo.png"
            alt=""
            width="40"
            height="40"
            aria-hidden="true"
          />
          <span className="navbar__wordmark">
            <Editable id="chrome.navbar.wordmark" as="span" className="navbar__wordmark-main">
              BMXC
            </Editable>
            <Editable id="chrome.navbar.established" as="span" className="navbar__wordmark-sub">
              Est. 1969
            </Editable>
          </span>
        </NavLink>

        <nav className="navbar__nav" aria-label="Main navigation">
          <ul className="navbar__list">
            {LINKS.map((link) => (
              <li key={link.to}>
                {link.external ? (
                  <a href={link.to} className="navbar__link">
                    <Editable
                      id={`chrome.navbar.link.${link.to}.label`}
                      label={`Nav — ${link.label}`}
                      as="span"
                      className="navbar__link-text"
                    >
                      {link.label}
                    </Editable>
                    <span className="navbar__link-lane" aria-hidden="true" />
                  </a>
                ) : (
                  <NavLink
                    to={link.to}
                    end={link.to === '/'}
                    className={({ isActive }) => `navbar__link${isActive ? ' is-active' : ''}`}
                  >
                    <Editable
                      id={`chrome.navbar.link.${link.to}.label`}
                      label={`Nav — ${link.label}`}
                      as="span"
                      className="navbar__link-text"
                    >
                      {link.label}
                    </Editable>
                    <span className="navbar__link-lane" aria-hidden="true" />
                  </NavLink>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <button
          type="button"
          className="navbar__toggle"
          aria-expanded={isMenuOpen}
          aria-controls="mobile-menu"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {/* Two ids rather than one: the label is a state ternary, and a
              single node would let one wording overwrite the other. Only the
              current state renders, so only one is ever addressable at a
              time — which is also how it reads in the layers panel. */}
          {isMenuOpen ? (
            <Editable id="chrome.navbar.menu.close" as="span" className="sr-only">
              Close menu
            </Editable>
          ) : (
            <Editable id="chrome.navbar.menu.open" as="span" className="sr-only">
              Open menu
            </Editable>
          )}
          <span className="navbar__toggle-bar navbar__toggle-bar--top" aria-hidden="true" />
          <span className="navbar__toggle-bar navbar__toggle-bar--bottom" aria-hidden="true" />
        </button>
      </div>

      <div className="navbar__drawer" id="mobile-menu" hidden={!isMenuOpen}>
        <ul className="navbar__drawer-list">
          {LINKS.map((link, index) => (
            <li key={link.to} style={{ '--item-index': index }}>
              {link.external ? (
                <a href={link.to} className="navbar__drawer-link">
                  <span className="navbar__drawer-index">{String(index + 1).padStart(2, '0')}</span>
                  <Editable
                    id={`chrome.navbar.drawer.${link.to}.label`}
                    label={`Menu — ${link.label}`}
                    as="span"
                  >
                    {link.label}
                  </Editable>
                </a>
              ) : (
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) => `navbar__drawer-link${isActive ? ' is-active' : ''}`}
                >
                  <span className="navbar__drawer-index">{String(index + 1).padStart(2, '0')}</span>
                  <Editable
                    id={`chrome.navbar.drawer.${link.to}.label`}
                    label={`Menu — ${link.label}`}
                    as="span"
                  >
                    {link.label}
                  </Editable>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
