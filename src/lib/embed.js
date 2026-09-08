/**
 * Turns a pasted link into an embed URL, or nothing.
 *
 * The editor lets someone type a URL, and that URL would end up in an
 * `<iframe src>`. Passing it through would mean a person holding the `design`
 * permission could frame anything at all on bmxc.camp — an arbitrary origin,
 * a look-alike payment page, a `javascript:` URL. Design permission is not
 * permission to serve arbitrary content from the camp's domain.
 *
 * So nothing is passed through. Each provider matches on host and path,
 * extracts an id, validates that id against a narrow character class, and the
 * embed URL is **rebuilt** from a literal template. A link that does not match
 * a provider returns null and the section renders a message instead.
 *
 * Kept free of React so it can be unit-tested directly and imported anywhere.
 */

/** What the inspector offers, and what the empty state names. */
export const EMBED_PROVIDERS = Object.freeze(['YouTube', 'Spotify', 'Google Maps']);

/** Ids are used to build a URL, so they may only contain URL-safe characters. */
const YOUTUBE_ID = /^[\w-]{11}$/;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const SPOTIFY_KINDS = new Set(['playlist', 'album', 'track', 'episode', 'show', 'artist']);

function parseUrl(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  // Anything not http(s) is rejected before host matching, so `javascript:`
  // and `data:` never reach a branch that could build a src.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
  return parsed;
}

/** `www.` and a trailing dot are noise; compare the rest exactly. */
function host(parsed) {
  return parsed.hostname.replace(/^www\./, '').replace(/\.$/, '').toLowerCase();
}

function youTube(parsed) {
  const h = host(parsed);
  let id = null;
  if (h === 'youtube.com' || h === 'm.youtube.com' || h === 'music.youtube.com') {
    if (parsed.pathname === '/watch') id = parsed.searchParams.get('v');
    else if (parsed.pathname.startsWith('/embed/')) id = parsed.pathname.slice(7);
    else if (parsed.pathname.startsWith('/shorts/')) id = parsed.pathname.slice(8);
  } else if (h === 'youtu.be') {
    id = parsed.pathname.slice(1);
  }
  if (!id || !YOUTUBE_ID.test(id)) return null;
  // youtube-nocookie, matching the video page: no cookie until someone plays.
  return { provider: 'YouTube', src: `https://www.youtube-nocookie.com/embed/${id}`, title: 'YouTube video' };
}

function spotify(parsed) {
  const h = host(parsed);
  if (h !== 'open.spotify.com') return null;
  // /playlist/<id>, and also /intl-de/playlist/<id>
  const parts = parsed.pathname.split('/').filter(Boolean);
  const start = parts[0]?.startsWith('intl-') ? 1 : 0;
  const kind = parts[start];
  const id = parts[start + 1];
  if (!SPOTIFY_KINDS.has(kind) || !id || !SPOTIFY_ID.test(id)) return null;
  return { provider: 'Spotify', src: `https://open.spotify.com/embed/${kind}/${id}`, title: 'Spotify player' };
}

function googleMaps(parsed) {
  const h = host(parsed);
  if (h !== 'google.com' && !h.startsWith('google.') && h !== 'maps.google.com') return null;
  if (!parsed.pathname.startsWith('/maps')) return null;
  // Only the already-embeddable form is accepted. A normal /maps link cannot
  // be turned into one without an API key, and guessing at a rewrite is how
  // you end up with a broken frame on a live page.
  if (!parsed.pathname.startsWith('/maps/embed')) return null;
  const pb = parsed.searchParams.get('pb');
  if (!pb || !/^[\w!.,:@$*-]+$/.test(pb)) return null;
  return {
    provider: 'Google Maps',
    src: `https://www.google.com/maps/embed?pb=${encodeURIComponent(pb)}`,
    title: 'Map',
  };
}

/**
 * The embed for `raw`, or null if it is not a link this site will frame.
 *
 * Returns `{ provider, src, title }`. `src` is always rebuilt from a literal
 * template and a validated id — never the input string.
 */
export function embedUrl(raw) {
  const parsed = parseUrl(raw);
  if (!parsed) return null;
  return youTube(parsed) ?? spotify(parsed) ?? googleMaps(parsed) ?? null;
}
