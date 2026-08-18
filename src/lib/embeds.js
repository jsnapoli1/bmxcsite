// Helpers that turn the share links you copy out of Spotify and YouTube
// straight into embeddable URLs, so the page data can just be pasted links.

// Spotify resource types that have an embed player.
const SPOTIFY_TYPES = ['playlist', 'album', 'track', 'artist', 'show', 'episode'];

/**
 * Accepts any of:
 *   https://open.spotify.com/playlist/6RrjJj8qaP7Aj4S28AQ2MK
 *   https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc&utm_source=copy-link
 *   https://open.spotify.com/intl-de/album/4m2880jivSbbyEGAKfITCa
 *   spotify:playlist:6RrjJj8qaP7Aj4S28AQ2MK
 * Returns { type, id }, or null if the link isn't an embeddable Spotify resource.
 */
export function parseSpotifyUrl(url) {
  if (!url) return null;
  const types = SPOTIFY_TYPES.join('|');
  const uri = url.match(new RegExp(`^spotify:(${types}):([A-Za-z0-9]+)`));
  if (uri) return { type: uri[1], id: uri[2] };
  const web = url.match(
    new RegExp(`open\\.spotify\\.com/(?:intl-[a-z-]+/)?(${types})/([A-Za-z0-9]+)`),
  );
  return web ? { type: web[1], id: web[2] } : null;
}

export function spotifyEmbedUrl(url) {
  const parsed = parseSpotifyUrl(url);
  return parsed ? `https://open.spotify.com/embed/${parsed.type}/${parsed.id}` : null;
}

/**
 * Accepts any of:
 *   https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   https://youtu.be/dQw4w9WgXcQ
 *   https://www.youtube.com/embed/dQw4w9WgXcQ
 *   https://www.youtube.com/shorts/dQw4w9WgXcQ
 * Returns null if no video id can be found.
 */
export function youtubeVideoId(url) {
  if (!url) return null;
  const patterns = [
    /[?&]v=([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/,
    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function youtubeEmbedUrl(url) {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
