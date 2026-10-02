import { useEffect, useState } from 'react';
import './lasers.css';

const COLORS = ['#ff2d55', '#30ff6a', '#2de1ff', '#c040ff', '#c09018'];
const BEAMS_PER_CLICK = 7;
const BEAM_MS = 900;

let nextId = 0;

/**
 * A burst of laser beams from wherever the visitor clicks, for as long as
 * this is mounted. Rendered only on the DJ's profile page.
 *
 * The overlay never takes a click (`pointer-events: none`), so links and the
 * editor's selection work underneath it, and it is hidden from assistive
 * technology. Nothing fires for a visitor who has asked for reduced motion.
 */
export default function Lasers() {
  const [bursts, setBursts] = useState([]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

    function fire(event) {
      if (reduced.matches) return;
      const id = nextId++;
      const offset = Math.random() * 360;
      const beams = Array.from({ length: BEAMS_PER_CLICK }, (_, i) => ({
        angle: offset + (360 / BEAMS_PER_CLICK) * i + (Math.random() * 20 - 10),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      }));
      setBursts((current) => [...current, { id, x: event.clientX, y: event.clientY, beams }]);
      setTimeout(() => {
        setBursts((current) => current.filter((burst) => burst.id !== id));
      }, BEAM_MS);
    }

    document.addEventListener('pointerdown', fire);
    return () => document.removeEventListener('pointerdown', fire);
  }, []);

  return (
    <div className="lasers" aria-hidden="true">
      {bursts.map((burst) =>
        burst.beams.map((beam, i) => (
          <span
            key={`${burst.id}-${i}`}
            className="lasers__beam"
            style={{
              left: burst.x,
              top: burst.y,
              '--laser-angle': `${beam.angle}deg`,
              '--laser-color': beam.color,
              '--laser-ms': `${BEAM_MS}ms`,
            }}
          />
        )),
      )}
    </div>
  );
}
