import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import './navbar.css';

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/camp', label: 'The Week' },
  { to: '/playlists', label: 'Playlists' },
  { to: '/videos', label: 'Videos' },
  { to: '/staff', label: 'Staff' },
  { to: '/faq', label: 'FAQ' },
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
          <span className="navbar__mark" aria-hidden="true">
            <span className="navbar__mark-peak" />
          </span>
          <span className="navbar__wordmark">
            <span className="navbar__wordmark-main">BMXC</span>
            <span className="navbar__wordmark-sub">Est. 1969</span>
          </span>
        </NavLink>

        <nav className="navbar__nav" aria-label="Main navigation">
          <ul className="navbar__list">
            {LINKS.map((link) => (
              <li key={link.to}>
                <NavLink
                  to={link.to}
                  end={link.to === '/'}
                  className={({ isActive }) => `navbar__link${isActive ? ' is-active' : ''}`}
                >
                  <span className="navbar__link-text">{link.label}</span>
                  <span className="navbar__link-lane" aria-hidden="true" />
                </NavLink>
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
          <span className="sr-only">{isMenuOpen ? 'Close menu' : 'Open menu'}</span>
          <span className="navbar__toggle-bar" aria-hidden="true" />
          <span className="navbar__toggle-bar" aria-hidden="true" />
        </button>
      </div>

      <div className="navbar__drawer" id="mobile-menu" hidden={!isMenuOpen}>
        <ul className="navbar__drawer-list">
          {LINKS.map((link, index) => (
            <li key={link.to} style={{ '--item-index': index }}>
              <NavLink
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) => `navbar__drawer-link${isActive ? ' is-active' : ''}`}
              >
                <span className="navbar__drawer-index">{String(index + 1).padStart(2, '0')}</span>
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
