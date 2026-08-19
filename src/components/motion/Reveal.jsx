import useInView from '../../hooks/useInView.js';
import './motion.css';

/**
 * Reveals children on scroll. `delay` staggers siblings; `variant` picks the
 * direction of travel. Motion is compositor-only (transform + opacity).
 */
export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  as: Tag = 'div',
  className = '',
  ...rest
}) {
  const [ref, isInView] = useInView();

  return (
    <Tag
      ref={ref}
      className={`reveal reveal-${variant}${isInView ? ' is-visible' : ''} ${className}`}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}
