import './lasers.css';

/*
 * Each corner aims into the page: `base` is the angle that points along the
 * near edge, and the beams sweep 90deg inward from there.
 */
const CORNERS = [
  { corner: 'top-left', base: 0, offset: 0 },
  { corner: 'top-right', base: 90, offset: -1700 },
  { corner: 'bottom-right', base: 180, offset: -900 },
  { corner: 'bottom-left', base: 270, offset: -2900 },
];

const BEAMS = [
  { color: '#ff2d55', ms: 2600, delay: 0 },
  { color: '#30ff6a', ms: 3400, delay: -1200 },
  { color: '#2de1ff', ms: 4200, delay: -2500 },
];

/* Animated GIFs from GifCities, the Internet Archive's GeoCities collection. */
const FIREWORKS = [
  { name: 'rockets-top', src: '/fx/rockets.gif', width: 100, height: 125, style: { top: '12%', left: '3%' } },
  { name: 'blue', src: '/fx/burst-blue.gif', width: 100, height: 100, style: { top: '8%', right: '6%' }, narrow: true },
  { name: 'stars', src: '/fx/stars.gif', width: 200, height: 200, style: { top: '38%', right: '1%' }, narrow: true },
  { name: 'green', src: '/fx/burst-green.gif', width: 156, height: 119, style: { bottom: '10%', left: '2%' } },
  { name: 'orange', src: '/fx/burst-orange.gif', width: 91, height: 79, style: { bottom: '22%', right: '12%' } },
  { name: 'multi', src: '/fx/burst-multi.gif', width: 106, height: 105, style: { top: '45%', left: '1%' } },
  { name: 'rockets-bottom', src: '/fx/rockets.gif', width: 100, height: 125, style: { bottom: '4%', right: '3%' } },
];

/**
 * A late-90s light show for the DJ's profile: laser rigs in all four corners
 * sweeping the page, and GeoCities fireworks around the edges, for as long as
 * the page is open.
 *
 * Purely decorative. It never takes a click (`pointer-events: none`), is
 * hidden from assistive technology, and does not render at all for a visitor
 * who has asked for reduced motion.
 */
export default function Lasers() {
  return (
    <div className="lasers" aria-hidden="true">
      {CORNERS.map(({ corner, base, offset }) => (
        <div key={corner} className={`lasers__rig lasers__rig--${corner}`}>
          {BEAMS.map((beam, i) => (
            <span
              key={beam.color}
              className="lasers__beam"
              style={{
                '--laser-from': `${base + 8 + i * 6}deg`,
                '--laser-to': `${base + 82 - i * 6}deg`,
                '--laser-color': beam.color,
                animationDuration: `${beam.ms}ms`,
                animationDelay: `${beam.delay + offset}ms`,
              }}
            />
          ))}
        </div>
      ))}
      {FIREWORKS.map((firework) => (
        <img
          key={firework.name}
          className={`lasers__firework lasers__firework--${firework.name}${firework.narrow ? '' : ' lasers__firework--wide-only'}`}
          src={firework.src}
          width={firework.width}
          height={firework.height}
          style={firework.style}
          alt=""
          decoding="async"
        />
      ))}
    </div>
  );
}
