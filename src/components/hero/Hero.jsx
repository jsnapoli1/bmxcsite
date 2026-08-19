import { CAMP, STATS } from '../../data/camp.js';
import Button from '../ui/Button.jsx';
import Reveal from '../motion/Reveal.jsx';
import SplitText from '../motion/SplitText.jsx';
import './hero.css';

export default function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      {/* Layered atmosphere: ridgelines, drifting lane, and grain. */}
      <div className="hero__atmosphere" aria-hidden="true">
        <div className="hero__ridge hero__ridge--far" />
        <div className="hero__ridge hero__ridge--mid" />
        <div className="hero__ridge hero__ridge--near" />
        <div className="hero__grain" />
      </div>

      <div className="hero__inner container-wide">
        <Reveal variant="fade" className="hero__eyebrow">
          <span className="eyebrow eyebrow-light">
            Est. {CAMP.founded} · {CAMP.venue.town}
          </span>
        </Reveal>

        <h1 className="hero__title" id="hero-heading">
          <SplitText as="span" text="Blue Mountain" className="hero__title-line" />
          <SplitText
            as="span"
            text="Cross Country Camp"
            className="hero__title-line hero__title-line--accent"
            delay={220}
          />
        </h1>

        <Reveal delay={520} className="hero__lead">
          <p>{CAMP.tagline}</p>
        </Reveal>

        <Reveal delay={640} className="hero__actions">
          <Button to="/registration" variant="accent" size="lg">
            Register for {CAMP.session.year}
          </Button>
          <Button to="/camp" variant="light" size="lg">
            See the week
          </Button>
        </Reveal>

        <Reveal delay={760} className="hero__session">
          <span className="hero__session-dot" aria-hidden="true" />
          <span>
            {CAMP.session.year} session · {CAMP.session.start} – {CAMP.session.end}
          </span>
        </Reveal>
      </div>

      {/* Stat strip anchors the hero and bleeds into the next section. */}
      <div className="hero__stats container-wide">
        {STATS.map((stat, index) => (
          <Reveal key={stat.label} delay={880 + index * 90} className="hero__stat">
            <span className="hero__stat-value">{stat.value}</span>
            <span className="hero__stat-label">{stat.label}</span>
            <span className="hero__stat-detail">{stat.detail}</span>
          </Reveal>
        ))}
      </div>

      <div className="hero__scroll" aria-hidden="true">
        <span className="hero__scroll-line" />
      </div>
    </section>
  );
}
