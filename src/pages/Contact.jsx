import PageHeader from '../components/layout/PageHeader.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import Button from '../components/ui/Button.jsx';
import { CAMP } from '../data/camp.js';
import './contact.css';

const CHANNELS = [
  {
    label: 'Email',
    value: CAMP.contact.email,
    href: `mailto:${CAMP.contact.email}`,
    note: 'The fastest way to reach Ken and Sarah.',
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

export default function Contact() {
  return (
    <>
      <PageHeader
        eyebrow="Say hello"
        title="Contact Us"
        lead={`Camp is run by ${CAMP.contact.directors}. Email is the fastest way to get an answer — they answer everything.`}
      />

      <section className="section container contact" aria-labelledby="contact-heading">
        <h2 className="sr-only" id="contact-heading">Ways to reach us</h2>

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
                <span className="contact-card__value">{channel.value}</span>
                <span className="contact-card__note">{channel.note}</span>
                <span className="contact-card__arrow" aria-hidden="true">→</span>
              </a>
            </Reveal>
          ))}
        </ul>

        <div className="contact__addresses">
          <Reveal delay={120} className="contact-address">
            <h3 className="contact-address__title">Mailing address</h3>
            <p className="contact-address__note">
              For checks and paperwork. This is not the camp location.
            </p>
            <address>
              <span>{CAMP.contact.mailing.line1}</span>
              <span>{CAMP.contact.mailing.line2}</span>
              <span>{CAMP.contact.mailing.line3}</span>
            </address>
          </Reveal>

          <Reveal delay={200} className="contact-address">
            <h3 className="contact-address__title">Camp location</h3>
            <p className="contact-address__note">
              {CAMP.venue.name}, an {CAMP.venue.accreditation} facility in the{' '}
              {CAMP.venue.region}. The driving address differs from the mailing address.
            </p>
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
    </>
  );
}
