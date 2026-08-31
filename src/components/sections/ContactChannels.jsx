import { Editable } from 'vedit';
import Button from '../ui/Button.jsx';
import Reveal from '../motion/Reveal.jsx';
import { CAMP } from '../../data/camp.js';

const CHANNELS = [
  {
    label: 'Email',
    value: CAMP.contact.email,
    href: `mailto:${CAMP.contact.email}`,
    // Wording adopted from a published vedit override, so it survives the
    // move to composed pages — the override targeted a scanner id, which
    // this page's new structure no longer emits.
    note: 'The fastest way to reach the admin team at Blue Mountain.',
  },
  {
    label: 'Phone',
    value: CAMP.contact.phone,
    href: `tel:${CAMP.contact.phone.replace(/-/g, '')}`,
    note: 'Call or text during normal hours.',
  },
  {
    label: 'Facebook',
    value: 'Blue Mountain Cross Country Camp',
    href: CAMP.social.facebook,
    note: 'Photos go up here every night during camp week.',
  },
  {
    label: 'Instagram',
    value: '@bluemountainxc',
    href: CAMP.social.instagram,
    note: 'Camp week, as it happens.',
  },
];

/**
 * How to reach the directors, plus both addresses.
 *
 * Lifted out of Contact.jsx unchanged so it can be placed, moved and removed
 * from the editor. Registered with `wrap: false` — see HomeIntro.jsx for why
 * the placement id is threaded into the nested ids.
 */
export default function ContactChannels({ id = 'contact.channels', ...rest }) {
  // Derived from the placement id so two copies stay valid HTML.
  const headingId = `${id}-heading`;

  return (
    <section {...rest} className="section container contact" aria-labelledby={headingId}>
      <h2 className="sr-only" id={headingId}>Ways to reach us</h2>

      <ul className="contact__channels">
        {CHANNELS.map((channel, index) => (
          <Reveal as="li" key={channel.label} delay={Math.min(index, 5) * 45}>
            <a
              className="contact-card"
              href={channel.href}
              {...(channel.href.startsWith('http')
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              <span className="contact-card__label">{channel.label}</span>
              <Editable
                id={`${id}.channel.${channel.label}.value`}
                as="span"
                className="contact-card__value"
              >
                {channel.value}
              </Editable>
              <Editable
                id={`${id}.channel.${channel.label}.note`}
                as="span"
                className="contact-card__note"
              >
                {channel.note}
              </Editable>
              <span className="contact-card__arrow" aria-hidden="true">→</span>
            </a>
          </Reveal>
        ))}
      </ul>

      <div className="contact__addresses">
        <Reveal delay={120} className="contact-address">
          <Editable id="contact.mailing.title" as="h3" className="contact-address__title">
            Mailing address
          </Editable>
          <Editable id="contact.mailing.note" as="p" className="contact-address__note">
            For checks and paperwork. This is not the camp location.
          </Editable>
          <address>
            <span>{CAMP.contact.mailing.line1}</span>
            <span>{CAMP.contact.mailing.line2}</span>
            <span>{CAMP.contact.mailing.line3}</span>
          </address>
        </Reveal>

        <Reveal delay={200} className="contact-address">
          <Editable id="contact.location.title" as="h3" className="contact-address__title">
            Camp location
          </Editable>
          <Editable id="contact.location.note" as="p" className="contact-address__note">
            {CAMP.venue.name}, an {CAMP.venue.accreditation} facility in the{' '}
            {CAMP.venue.region}. The driving address differs from the mailing address.
          </Editable>
          <address>
            <span>{CAMP.venue.name}</span>
            <span>{CAMP.venue.town}</span>
          </address>
          <Button href="https://maps.google.com/?q=Blue+Mountain+XC+Camp" variant="ghost">
            Open in Google Maps →
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
