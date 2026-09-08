import { Editable } from 'vedit';
import Reveal from '../motion/Reveal.jsx';
import SectionHeading from '../ui/SectionHeading.jsx';
import { embedUrl, EMBED_PROVIDERS } from '../../lib/embed.js';
import './embed-section.css';

/**
 * A placed embed: paste a YouTube, Spotify or Google Maps link and it plays.
 *
 * This exists because the site's two existing iframes (the Spotify player and
 * the video stage) are hardcoded in JSX, so adding a video or a map meant a
 * deploy. Registered with `wrap: false` like every other section — see
 * HomeIntro.jsx for why the placement `id` has to arrive as a prop.
 *
 * **The URL is not passed through.** `embedUrl` parses it, matches it against
 * a fixed provider list, and rebuilds the embed URL from the id it extracted.
 * An editor field that reached an iframe `src` unfiltered would be a way to
 * frame anything at all on bmxc.camp — a `javascript:` URL, a look-alike
 * payment page — from a permission granted for design. Nothing outside
 * EMBED_PROVIDERS renders, and the panel says so rather than failing silently.
 */
export const EMBED_DEFAULTS = Object.freeze({
  eyebrow: '',
  title: '',
  url: '',
  ratio: '16 / 9',
  caption: '',
});

export default function EmbedSection({
  id = 'embed',
  eyebrow = EMBED_DEFAULTS.eyebrow,
  title = EMBED_DEFAULTS.title,
  url = EMBED_DEFAULTS.url,
  ratio = EMBED_DEFAULTS.ratio,
  caption = EMBED_DEFAULTS.caption,
  ...rest
}) {
  const embed = embedUrl(url);
  const headingId = `${id}-heading`;

  return (
    <section
      {...rest}
      className="section container embed-section"
      {...(title ? { 'aria-labelledby': headingId } : {})}
    >
      {title ? (
        <SectionHeading
          id={`${id}.heading`}
          headingId={headingId}
          eyebrow={eyebrow}
          title={title}
          as="h2"
        />
      ) : null}

      <Reveal variant="scale" className="embed-section__frame" style={{ aspectRatio: ratio }}>
        {embed ? (
          <iframe
            className="embed-section__iframe"
            src={embed.src}
            title={embed.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          /* Shown in place of the embed rather than nothing, so a bad link is
             visible in the editor instead of rendering an empty band. */
          <p className="embed-section__empty">
            {url
              ? 'That link is not one this site can embed. Paste a YouTube, Spotify or Google Maps link.'
              : 'Paste a YouTube, Spotify or Google Maps link in the inspector.'}
          </p>
        )}
      </Reveal>

      {caption ? (
        <Editable id={`${id}.caption`} as="p" className="embed-section__caption">
          {caption}
        </Editable>
      ) : null}
    </section>
  );
}

export { EMBED_PROVIDERS };
