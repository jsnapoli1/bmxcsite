import Hero from '../components/hero/Hero.jsx';
import SectionHeading from '../components/ui/SectionHeading.jsx';
import Button from '../components/ui/Button.jsx';
import Reveal from '../components/motion/Reveal.jsx';
import { CAMP, PILLARS } from '../data/camp.js';
import './home.css';

export default function Home() {
  return (
    <>
      <Hero />

      {/* --- Intro: the camp in its own words --- */}
      <section className="section container" aria-labelledby="intro-heading">
        <div className="home-intro">
          <SectionHeading
            eyebrow="Since 1969"
            title="The oldest and longest running XC summer camp in the Northeast"
            as="h2"
            className="home-intro__heading"
          />
          <Reveal delay={140} className="home-intro__body">
            <p className="home-intro__lead">{CAMP.intro}</p>
            <p>{CAMP.reach}</p>
            <Button to="/camp" variant="ghost">What a week looks like →</Button>
          </Reveal>
        </div>
      </section>

      {/* --- Pillars: bento-ish grid, deliberately uneven --- */}
      <section className="section home-pillars" aria-labelledby="pillars-heading">
        <div className="container">
          <SectionHeading
            eyebrow="What makes it BMXC"
            title="Built around the running, and everything that surrounds it"
            lead="Three hundred campers, seventy teams, one week on the mountain."
            as="h2"
          />

          <div className="home-pillars__grid">
            {PILLARS.map((pillar, index) => (
              <Reveal
                key={pillar.title}
                delay={Math.min(index, 5) * 50}
                className={`pillar-card pillar-card--${index === 0 ? 'wide' : 'standard'}`}
              >
                <span className="pillar-card__tag">{pillar.tag}</span>
                <h3 className="pillar-card__title">{pillar.title}</h3>
                <p className="pillar-card__body">{pillar.body}</p>
                <span className="pillar-card__index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* --- Location --- */}
      <section className="section home-location" aria-labelledby="location-heading">
        <div className="container home-location__inner">
          <SectionHeading
            eyebrow="The place"
            title="Camp Westmont, in the Pocono Mountains"
            tone="light"
            as="h2"
          />
          <Reveal delay={160} className="home-location__body">
            <p>
              We run miles and miles of scenic dirt roads and trails out of an ACA-accredited
              facility in {CAMP.venue.town}. It is all-inclusive: a dining hall with healthy
              and filling meals, separate boys and girls cabins, a private lake, and a program
              of educational and fun activities.
            </p>
            <ul className="home-location__facts">
              <li><span>Venue</span>{CAMP.venue.name}</li>
              <li><span>Region</span>{CAMP.venue.region}</li>
              <li><span>Buses from</span>Buffalo, Rochester, Syracuse, Rockaway & Woodbridge</li>
            </ul>
            <Button href="https://maps.google.com/?q=Blue+Mountain+XC+Camp" variant="light">
              Open in Google Maps
            </Button>
          </Reveal>
        </div>
      </section>

      {/* --- Closing CTA --- */}
      <section className="section container" aria-labelledby="cta-heading">
        <Reveal variant="scale" className="home-cta">
          <span className="eyebrow eyebrow-accent">{CAMP.session.year} session</span>
          <h2 className="home-cta__title" id="cta-heading">
            {CAMP.session.start} – {CAMP.session.end}
          </h2>
          <p className="home-cta__body">
            Registration opens January 1st at 12:01am. We are usually 80% full by early May,
            and buses fill even sooner.
          </p>
          <div className="home-cta__actions">
            <Button to="/registration" variant="primary" size="lg">Registration & pricing</Button>
            <Button to="/faq" variant="outline" size="lg">Read the FAQ</Button>
          </div>
        </Reveal>
      </section>
    </>
  );
}
