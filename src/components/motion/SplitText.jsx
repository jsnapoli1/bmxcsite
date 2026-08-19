import useInView from '../../hooks/useInView.js';
import './motion.css';

/**
 * Splits a headline into words that rise into place like runners crossing a
 * line — staggered, one after another. Splitting on words (not characters)
 * keeps the text selectable and readable to screen readers.
 *
 * The separating space is rendered inside its own span rather than as a bare
 * text node between inline-block words, where it would collapse to nothing.
 */
export default function SplitText({
  text,
  as: Tag = 'span',
  className = '',
  stagger = 55,
  delay = 0,
}) {
  const [ref, isInView] = useInView({ threshold: 0 });
  const words = String(text).split(' ');

  return (
    <Tag ref={ref} className={`split-text${isInView ? ' is-visible' : ''} ${className}`}>
      {words.map((word, index) => (
        // Words are positional and may repeat, so index is the stable key here.
        <span className="split-text__word" key={`${word}-${index}`}>
          <span
            className="split-text__inner"
            style={{ '--word-delay': `${delay + index * stagger}ms` }}
          >
            {word}
          </span>
          {index < words.length - 1 ? <span className="split-text__space"> </span> : null}
        </span>
      ))}
    </Tag>
  );
}
