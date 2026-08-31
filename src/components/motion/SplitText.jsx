import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import useInView from '../../hooks/useInView.js';
import './motion.css';

/**
 * Splits a headline into words that rise into place like runners crossing a
 * line — staggered, one after another. Splitting on words (not characters)
 * keeps the text selectable and readable to screen readers.
 *
 * The separating space is rendered inside its own span rather than as a bare
 * text node between inline-block words, where it would collapse to nothing.
 *
 * `continuousFill` measures each word's offset within the line and exposes it
 * as --word-x / --line-w. A gradient applied to the words can then be sized to
 * the whole line and shifted into place, so it reads as one unbroken ramp
 * instead of restarting at every word.
 *
 * The word spans are kept out of the visual editor by the `autoSelector`
 * passed to VeditProvider (see visual-editor-provider.jsx), which excludes
 * `.split-text__word` and friends. Without that the scanner — which matches
 * `span` and treats any childless element holding text as its own node —
 * turns one headline into a row of one-word boxes, three spans deep per word.
 *
 * Deliberately NOT `data-vedit-ui`: that attribute means "this is editor
 * chrome, ignore clicks here entirely", and vedit tests it with `closest()`.
 * Putting it on the words made every heading unselectable — a click landed
 * on a word, the ancestor test matched, and the lookup returned null before
 * it could reach the `<Editable>` wrapping the line.
 */
export default function SplitText({
  text,
  as: Tag = 'span',
  id,
  className = '',
  stagger = 38,
  delay = 0,
  continuousFill = false,
}) {
  const [ref, isInView] = useInView({ threshold: 0 });
  const hostRef = useRef(null);
  const [metrics, setMetrics] = useState(null);
  const words = String(text).split(' ');

  // Combine the in-view ref with our own measuring ref.
  const setRefs = useCallback(
    (node) => {
      hostRef.current = node;
      ref.current = node;
    },
    [ref],
  );

  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const hostBox = host.getBoundingClientRect();
    const offsets = [...host.querySelectorAll('.split-text__inner')].map(
      (el) => el.getBoundingClientRect().left - hostBox.left,
    );
    setMetrics({ lineWidth: hostBox.width, offsets });
  }, []);

  // Measure before paint so the gradient never flashes in misaligned.
  useLayoutEffect(() => {
    if (!continuousFill) return undefined;
    measure();
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return undefined;
    // Re-measure on reflow: viewport changes, and late-loading webfonts
    // both change where each word sits on the line.
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [continuousFill, measure, text]);

  // Webfonts swapping in after load shift every word's offset.
  useEffect(() => {
    if (!continuousFill || !document.fonts) return undefined;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) measure();
    });
    return () => {
      cancelled = true;
    };
  }, [continuousFill, measure]);

  return (
    <Tag
      ref={setRefs}
      id={id}
      className={`split-text${isInView ? ' is-visible' : ''} ${className}`}
      style={
        continuousFill && metrics
          ? { '--line-w': `${metrics.lineWidth}px` }
          : undefined
      }
    >
      {words.map((word, index) => {
        const wordStyle = { '--word-delay': `${delay + index * stagger}ms` };
        if (continuousFill && metrics?.offsets[index] != null) {
          wordStyle['--word-x'] = `${metrics.offsets[index]}px`;
        }

        return (
          // Words are positional and may repeat, so index is the stable key here.
          <span className="split-text__word" key={`${word}-${index}`}>
            <span className="split-text__inner" style={wordStyle}>
              {word}
            </span>
            {index < words.length - 1 ? <span className="split-text__space"> </span> : null}
          </span>
        );
      })}
    </Tag>
  );
}
