import Reveal from '../motion/Reveal.jsx';
import SplitText from '../motion/SplitText.jsx';
import './page-header.css';

/** Shared masthead for interior pages. Dark band, oversized title. */
export default function PageHeader({ eyebrow, title, lead }) {
  return (
    <header className="page-header">
      <div className="page-header__lanes" aria-hidden="true">
        <div className="page-header__lanes-track" />
      </div>

      <div className="container page-header__inner">
        {eyebrow ? (
          <Reveal variant="fade">
            <span className="eyebrow eyebrow-light">{eyebrow}</span>
          </Reveal>
        ) : null}

        <SplitText as="h1" text={title} className="page-header__title" />

        {lead ? (
          <Reveal delay={130} className="page-header__lead measure">
            <p>{lead}</p>
          </Reveal>
        ) : null}
      </div>
    </header>
  );
}
