// Helpers that turn the share links you copy out of Spotify and YouTube
// straight into embeddable URLs, so the page data can just be pasted links.

/**
 * Accepts any of:
 *   https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa
 *   https://open.spotify.com/album/4m2880jivSbbyEGAKfITCa?si=abc123
 *   https://open.spotify.com/intl-de/album/4m2880jivSbbyEGAKfITCa
 *   spotify:album:4m2880jivSbbyEGAKfITCa
 * Returns null if no album id can be found.
 */
export function spotifyAlbumId(url) {
  if (!url) return null;
  const uri = url.match(/^spotify:album:([A-Za-z0-9]+)/);
  if (uri) return uri[1];
  const web = url.match(/open\.spotify\.com\/(?:intl-[a-z-]+\/)?album\/([A-Za-z0-9]+)/);
  return web ? web[1] : null;
}

export function spotifyAlbumEmbedUrl(url) {
  const id = spotifyAlbumId(url);
  return id ? `https://open.spotify.com/embed/album/${id}` : null;
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
