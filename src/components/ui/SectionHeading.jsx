import Reveal from '../motion/Reveal.jsx';
import SplitText from '../motion/SplitText.jsx';
import './section-heading.css';

/**
 * The shared section header: tracked eyebrow, oversized headline that reveals
 * word by word, and an optional lead paragraph.
 */
export default function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'start',
  tone = 'dark',
  as: Tag = 'h2',
  className = '',
}) {
  return (
    <div className={`section-heading section-heading--${align} section-heading--${tone} ${className}`}>
      {eyebrow ? (
        <Reveal variant="fade" className={`eyebrow${tone === 'light' ? ' eyebrow-light' : ''}`}>
          {eyebrow}
        </Reveal>
      ) : null}

      <SplitText as={Tag} text={title} className="section-heading__title" />

      {lead ? (
        <Reveal delay={110} className="section-heading__lead measure">
          <p>{lead}</p>
        </Reveal>
      ) : null}
    </div>
  );
}
