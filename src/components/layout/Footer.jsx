import { Link } from 'react-router-dom';
import { Editable } from 'vedit';
import { CAMP } from '../../data/camp.js';
import './footer.css';

const SITEMAP = [
  { to: '/camp', label: 'The Week' },
  { to: '/playlists', label: 'Playlists' },
  { to: '/videos', label: 'Videos' },
  { to: '/merch', label: 'Merch' },
  { to: '/staff', label: 'Staff' },
  { to: '/faq', label: 'FAQ' },
  { to: '/registration', label: 'Registration' },
  { to: '/contact', label: 'Contact' },
];

export default function Footer() {
  return (
    <footer className="footer">
      {/* A running track's lane lines, drifting slowly across the top edge. */}
      <div className="footer__lanes" aria-hidden="true">
        <div className="footer__lanes-track" />
      </div>

      <div className="footer__inner container-wide">
        <div className="footer__brand">
          <Editable id="chrome.footer.wordmark" as="p" className="footer__wordmark">
            BMXC
          </Editable>
          <Editable id="chrome.footer.tagline" as="p" className="footer__tagline">
            {CAMP.tagline}
          </Editable>
          <Editable
            id="chrome.footer.est"
            as="p"
            className="footer__est"
            vars={{ founded: CAMP.founded, town: CAMP.venue.town }}
          >
            {'Est. {founded} · {town}'}
          </Editable>
        </div>

        <nav className="footer__nav" aria-label="Footer navigation">
          <Editable id="chrome.footer.explore.heading" as="h2" className="footer__heading">
            Explore
          </Editable>
          <ul className="footer__list">
            {SITEMAP.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className="footer__link">
                  <Editable id={`chrome.footer.sitemap.${item.to}.label`} as="span">
                    {item.label}
                  </Editable>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="footer__contact">
          <Editable id="chrome.footer.contact.heading" as="h2" className="footer__heading">
            Get in touch
          </Editable>
          <ul className="footer__list">
            <li>
              <a href={`mailto:${CAMP.contact.email}`} className="footer__link">
                <Editable id="chrome.footer.contact.email" as="span" vars={{ email: CAMP.contact.email }}>
                  {'{email}'}
                </Editable>
              </a>
            </li>
            <li>
              <a href={`tel:${CAMP.contact.phone.replace(/-/g, '')}`} className="footer__link">
                <Editable id="chrome.footer.contact.phone" as="span" vars={{ phone: CAMP.contact.phone }}>
                  {'{phone}'}
                </Editable>
              </a>
            </li>
            <li>
              <a href={CAMP.social.facebook} className="footer__link" target="_blank" rel="noopener noreferrer">
                <Editable id="chrome.footer.social.facebook" as="span">Facebook</Editable>
              </a>
            </li>
            <li>
              <a href={CAMP.social.instagram} className="footer__link" target="_blank" rel="noopener noreferrer">
                <Editable id="chrome.footer.social.instagram" as="span">Instagram</Editable>
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="footer__base container-wide">
        <Editable
          id="chrome.footer.copyright"
          as="p"
          vars={{ founded: CAMP.founded, name: CAMP.name }}
        >
          {'© {founded}–present {name}.'}
        </Editable>
        <Editable id="chrome.footer.note" as="p" className="footer__base-note">
          The oldest and longest running XC summer camp in the Northeast.
        </Editable>
      </div>
    </footer>
  );
}
