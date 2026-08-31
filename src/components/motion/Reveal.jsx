import { useCallback } from 'react';
import useInView from '../../hooks/useInView.js';
import './motion.css';

/**
 * Reveals children on scroll. `delay` staggers siblings; `variant` picks the
 * direction of travel. Motion is compositor-only (transform + opacity).
 *
 * A caller's `ref` is merged with the in-view observer's rather than either
 * replacing the other. When a placed vedit component renders as a Reveal, it
 * passes its own ref for selection and outlining; spreading that over this
 * one left the observer watching nothing, so `is-visible` never landed and
 * the element stayed at `opacity: 0` — present in the DOM, invisible on the
 * page.
 */
export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  as: Tag = 'div',
  className = '',
  ref: forwardedRef,
  ...rest
}) {
  const [ref, isInView] = useInView();

  const setRefs = useCallback((node) => {
    ref.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [ref, forwardedRef]);

  return (
    <Tag
      ref={setRefs}
      className={`reveal reveal-${variant}${isInView ? ' is-visible' : ''} ${className}`}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
