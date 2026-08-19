import { useEffect, useRef, useState } from 'react';

/**
 * Fires once when an element scrolls into view. Uses IntersectionObserver
 * rather than a scroll handler to keep the main thread free.
 *
 * Elements already within the viewport on mount are revealed immediately —
 * IntersectionObserver reports them on its first callback, so above-the-fold
 * content never waits for a scroll that may never come.
 *
 * The default rootMargin extends the trigger zone 12% BELOW the viewport, so
 * an element starts fading in just before its top edge appears. A negative
 * margin does the opposite: it forces the element to travel well inside the
 * viewport before firing, which reads as motion lagging behind the scroll.
 */
export default function useInView({ threshold = 0, rootMargin = '0px 0px 12% 0px' } = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    // Without IntersectionObserver, show content rather than hiding it forever.
    if (typeof IntersectionObserver === 'undefined') {
      setIsInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setIsInView(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, isInView];
}
