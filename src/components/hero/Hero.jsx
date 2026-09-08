import { Editable, EditableImage } from 'vedit';
import { CAMP, STATS } from '../../data/camp.js';
import Button from '../ui/Button.jsx';
import Reveal from '../motion/Reveal.jsx';
import SplitText from '../motion/SplitText.jsx';
import './hero.css';

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      {/* A real photo of camp rather than a synthetic CSS mountain. */}
      <div className="hero__photo" aria-hidden="true">
        {/* The one photo used at size. EditableImage so the source can
            be swapped from the editor without a deploy; alt stays empty
            because the parent is aria-hidden and the photo is decorative. */}
        <EditableImage
          id="home.hero.photo"
          as="img"
          src="/photos/camp-group.jpg"
          alt=""
          width="1600"
          height="726"
          fetchPriority="high"
        />
      </div>

      <div className="hero__inner container-wide">
        {/* The founding year set as a masthead rule, the way a handbook
            or field guide states its edition. */}
        <Reveal variant="fade" className="hero__masthead">
          <Editable id="home.hero.established" as="span" className="hero__est">
            Established 1969
          </Editable>
          <span className="hero__rule" aria-hidden="true" />
          <Editable
            id="home.hero.place"
            as="span"
            className="hero__place"
            vars={{ town: CAMP.venue.town }}
          >
            {'{town}'}
          </Editable>
        </Reveal>

        {/* Each line is wrapped so the editor has one node per line to
            address. Without a wrapper these would not be editable at all:
            SplitText marks itself `data-vedit-ui`, which hides its word
            spans from the DOM scanner — the whole point, since otherwise a
            headline arrives as a row of one-word boxes. */}
        <h1 className="hero__title" id="hero-heading">
          <Editable id="home.hero.title.line1" as="span" className="hero__title-slot">
            <SplitText as="span" text="Blue Mountain" className="hero__title-line" />
          </Editable>
          <Editable id="home.hero.title.line2" as="span" className="hero__title-slot">
            <SplitText
              as="span"
              text="Cross Country Camp"
              className="hero__title-line hero__title-line--accent"
              delay={140}
              continuousFill
            />
          </Editable>
        </h1>

        <Reveal delay={300} className="hero__lead">
          <Editable id="home.hero.tagline" as="p">{CAMP.tagline}</Editable>
        </Reveal>

        <Reveal delay={380} className="hero__actions">
          {/* The year is a var, not baked into the label: a rewritten CTA
              still names the current session after the year rolls over. */}
          <Button
            id="home.hero.cta.register"
            to="/registration"
            variant="accent"
            size="lg"
            vars={{ year: CAMP.session.year }}
          >
            {'Register for {year}'}
          </Button>
          <Button id="home.hero.cta.week" to="/camp" variant="light" size="lg">
            See the week
          </Button>
        </Reveal>

        <Reveal delay={450} className="hero__session">
          <span className="hero__session-dot" aria-hidden="true" />
          {/* Dates stay live: the override keeps the sentence, the
              vars keep the session it names current. */}
          <Editable
            id="home.hero.session"
            as="span"
            vars={{
              year: CAMP.session.year,
              start: CAMP.session.start,
              end: CAMP.session.end,
            }}
          >
            {'{year} session · {start} – {end}'}
          </Editable>
        </Reveal>
      </div>

      {/* Stat strip anchors the hero and bleeds into the next section. */}
      <div className="hero__stats container-wide">
        {STATS.map((stat, index) => (
          <Reveal key={stat.label} delay={520 + Math.min(index, 3) * 55} className="hero__stat">
            <Editable id={`home.hero.stat.${stat.label}.value`} as="span" className="hero__stat-value">
              {stat.value}
            </Editable>
            <Editable id={`home.hero.stat.${stat.label}.label`} as="span" className="hero__stat-label">
              {stat.label}
            </Editable>
            <Editable id={`home.hero.stat.${stat.label}.detail`} as="span" className="hero__stat-detail">
              {stat.detail}
            </Editable>
          </Reveal>
        ))}
      </div>

      <div className="hero__scroll" aria-hidden="true">
        <span className="hero__scroll-line" />
      </div>
    </section>
  );
}
