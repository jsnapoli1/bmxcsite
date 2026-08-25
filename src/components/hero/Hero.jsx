import { Editable } from 'vedit';
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
        <img
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
          <span className="hero__place">{CAMP.venue.town}</span>
        </Reveal>

        <h1 className="hero__title" id="hero-heading">
          <SplitText as="span" text="Blue Mountain" className="hero__title-line" />
          <SplitText
            as="span"
            text="Cross Country Camp"
            className="hero__title-line hero__title-line--accent"
            delay={140}
            continuousFill
          />
        </h1>

        <Reveal delay={300} className="hero__lead">
          <Editable id="home.hero.tagline" as="p">{CAMP.tagline}</Editable>
        </Reveal>

        <Reveal delay={380} className="hero__actions">
          <Button to="/registration" variant="accent" size="lg">
            Register for {CAMP.session.year}
          </Button>
          <Button to="/camp" variant="light" size="lg">
            See the week
          </Button>
        </Reveal>

        <Reveal delay={450} className="hero__session">
          <span className="hero__session-dot" aria-hidden="true" />
          <span>
            {CAMP.session.year} session · {CAMP.session.start} – {CAMP.session.end}
          </span>
        </Reveal>
      </div>

      {/* Stat strip anchors the hero and bleeds into the next section. */}
      <div className="hero__stats container-wide">
        {STATS.map((stat, index) => (
          <Reveal key={stat.label} delay={520 + Math.min(index, 3) * 55} className="hero__stat">
            <Editable id={`home.hero.stat.${stat.label}.value`} as="span" className="hero__stat-value">
              {stat.value}
            </Editable>
            <span className="hero__stat-label">{stat.label}</span>
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
