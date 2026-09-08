/**
 * The embed URL parser is a trust boundary.
 *
 * A person with the `design` permission types a link and it becomes an
 * `<iframe src>` on bmxc.camp. Passing that string through would let design
 * permission serve arbitrary content from the camp's own domain, which is a
 * different and much larger thing than changing how a page looks.
 *
 * So the rule these tests pin is: the src is always rebuilt from a literal
 * template and a validated id, and anything that does not match a known
 * provider returns null.
 */
import { describe, it, expect } from 'vitest';
import { embedUrl, EMBED_PROVIDERS } from '../../src/lib/embed.js';

describe('embedUrl — YouTube', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s', 'dQw4w9WgXcQ'],
  ])('accepts %s', (url, id) => {
    expect(embedUrl(url)).toEqual({
      provider: 'YouTube',
      src: `https://www.youtube-nocookie.com/embed/${id}`,
      title: 'YouTube video',
    });
  });

  it('uses youtube-nocookie, so no cookie is set until someone plays', () => {
    expect(embedUrl('https://youtu.be/dQw4w9WgXcQ').src).toContain('youtube-nocookie.com');
  });

  it('rejects an id that is not exactly 11 url-safe characters', () => {
    expect(embedUrl('https://youtu.be/short')).toBeNull();
    expect(embedUrl('https://youtu.be/waaaaaaaaaaaaaaytoolong')).toBeNull();
    expect(embedUrl('https://youtu.be/bad/../../path')).toBeNull();
  });

  it('does not match a look-alike host', () => {
    expect(embedUrl('https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ')).toBeNull();
    expect(embedUrl('https://notyoutube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });
});

describe('embedUrl — Spotify', () => {
  const id = '4I8MieqHsOaN7fuqtGBBGE';

  it('accepts a playlist share link', () => {
    expect(embedUrl(`https://open.spotify.com/playlist/${id}`)).toEqual({
      provider: 'Spotify',
      src: `https://open.spotify.com/embed/playlist/${id}`,
      title: 'Spotify player',
    });
  });

  it('accepts the localised path Spotify sometimes hands out', () => {
    expect(embedUrl(`https://open.spotify.com/intl-de/album/${id}`)?.src)
      .toBe(`https://open.spotify.com/embed/album/${id}`);
  });

  it('drops the tracking query rather than forwarding it', () => {
    expect(embedUrl(`https://open.spotify.com/track/${id}?si=abc123`)?.src)
      .toBe(`https://open.spotify.com/embed/track/${id}`);
  });

  it('refuses a kind that is not on the list', () => {
    expect(embedUrl(`https://open.spotify.com/user/${id}`)).toBeNull();
  });

  it('refuses a malformed id', () => {
    expect(embedUrl('https://open.spotify.com/playlist/tooshort')).toBeNull();
  });
});

describe('embedUrl — Google Maps', () => {
  it('accepts the embed form and rebuilds it from the pb parameter', () => {
    const out = embedUrl('https://www.google.com/maps/embed?pb=!1m18!1m12!3d41.7');
    expect(out?.provider).toBe('Google Maps');
    expect(out?.src.startsWith('https://www.google.com/maps/embed?pb=')).toBe(true);
  });

  it('refuses a plain maps link, which cannot be embedded without a key', () => {
    expect(embedUrl('https://www.google.com/maps/place/Poyntelle+PA')).toBeNull();
    expect(embedUrl('https://maps.google.com/?q=Blue+Mountain')).toBeNull();
  });
});

describe('embedUrl — what it refuses', () => {
  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
  ])('refuses the %s scheme outright', (url) => {
    expect(embedUrl(url)).toBeNull();
  });

  it('refuses an arbitrary origin', () => {
    expect(embedUrl('https://evil.test/embed')).toBeNull();
    expect(embedUrl('https://bmxc.camp/register')).toBeNull();
  });

  it.each([null, undefined, '', '   ', 42, {}, [], 'not a url'])(
    'answers null for %s rather than throwing',
    (value) => {
      expect(embedUrl(value)).toBeNull();
    },
  );

  it('never returns a src it was given verbatim', () => {
    // The whole contract: every accepted src is rebuilt, so no input string
    // can reach the iframe unchanged.
    const inputs = [
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://open.spotify.com/playlist/4I8MieqHsOaN7fuqtGBBGE',
    ];
    for (const input of inputs) {
      expect(embedUrl(input).src).not.toBe(input);
    }
  });
});

describe('EMBED_PROVIDERS', () => {
  it('names exactly the providers the parser accepts', () => {
    expect(EMBED_PROVIDERS).toEqual(['YouTube', 'Spotify', 'Google Maps']);
  });
});
