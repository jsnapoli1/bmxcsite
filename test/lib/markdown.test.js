import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown.js';

describe('renderMarkdown', () => {
  it('renders a heading, a list, and a link', () => {
    const html = renderMarkdown(
      '# Camp Update\n\n- Pack a sleeping bag\n- Pack bug spray\n\n[Full packing list](https://bmxc.camp/packing)',
    );

    expect(html).toContain('<h1>Camp Update</h1>');
    expect(html).toContain('<li>Pack a sleeping bag</li>');
    expect(html).toContain('<li>Pack bug spray</li>');
    expect(html).toContain('href="https://bmxc.camp/packing"');
    expect(html).toContain('>Full packing list</a>');
  });

  it('does not render a raw <script> tag', () => {
    const html = renderMarkdown('Hello <script>alert(1)</script> world');

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('does not render raw HTML at all, even benign HTML like <b>', () => {
    const html = renderMarkdown('This is <b>bold</b> text.');

    expect(html).not.toContain('<b>');
    expect(html).not.toContain('</b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('strips a javascript: URL from a link', () => {
    const html = renderMarkdown('[click me](javascript:alert(1))');

    // No anchor is produced at all — the disallowed scheme means this
    // never becomes a link, only inert escaped text containing "click me".
    expect(html).not.toContain('<a ');
    expect(html).not.toMatch(/href\s*=\s*"javascript:/i);
    expect(html).toContain('click me');
  });

  it('strips a data: URL from a link', () => {
    const html = renderMarkdown(
      '[click me](data:text/html,<script>alert(1)</script>)',
    );

    expect(html).not.toContain('<a ');
    expect(html).not.toMatch(/href\s*=\s*"data:/i);
    // The embedded raw <script> inside the disallowed URL must also be
    // escaped, not just the missing link.
    expect(html).not.toContain('<script>');
    expect(html).toContain('click me');
  });

  it('strips a vbscript: URL from a link', () => {
    const html = renderMarkdown('[click me](vbscript:msgbox(1))');

    expect(html).not.toContain('<a ');
    expect(html).not.toMatch(/href\s*=\s*"vbscript:/i);
    expect(html).toContain('click me');
  });

  it('strips a scheme markdown-it itself would otherwise allow (tel:)', () => {
    // markdown-it's own default link validator only refuses javascript:,
    // vbscript:, file:, and most data: URLs — it does not refuse tel:, ftp:,
    // or other schemes. Our own allowlist (http/https/mailto only) has to
    // catch these independently, or this renderer would happily produce a
    // real <a href="tel:..."> link straight out of markdown-it's defaults.
    const html = renderMarkdown('[call](tel:+15555555555)');

    expect(html).not.toContain('<a ');
    expect(html).not.toMatch(/href\s*=\s*"tel:/i);
    expect(html).toContain('call');
  });

  it('does not render an onerror attribute', () => {
    const html = renderMarkdown('<img src=x onerror=alert(1)>');

    // html: false means the whole tag is escaped to visible text: there is
    // no live <img> element and therefore no live onerror attribute that a
    // browser would ever parse or execute. The literal characters may still
    // appear as inert text content, which is safe.
    expect(html).not.toContain('<img ');
    expect(html).not.toContain('<img>');
    expect(html).toContain('&lt;img');
    expect(html).toContain('&gt;');
  });

  it('leaves an em-dash intact', () => {
    const html = renderMarkdown(
      'The camp — established 1969 — is in the mountains.',
    );

    expect(html).toContain('The camp — established 1969 — is in the mountains.');
  });

  it('leaves curly quotes intact', () => {
    const html = renderMarkdown(`The camp uses 'smart quotes' and “curly” marks.`);

    expect(html).toContain(`'smart quotes'`);
    expect(html).toContain('“curly”');
  });

  it('adds rel="noopener noreferrer" to an external link', () => {
    const html = renderMarkdown('[camp](https://bmxc.camp)');

    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('target="_blank"');
  });

  it('allows a mailto: link', () => {
    const html = renderMarkdown('[email us](mailto:camp@bmxc.camp)');

    expect(html).toContain('href="mailto:camp@bmxc.camp"');
    expect(html).toContain('>email us</a>');
  });

  it('handles an empty string without throwing', () => {
    expect(() => renderMarkdown('')).not.toThrow();
    expect(renderMarkdown('')).toBe('');
  });

  it('handles null/undefined without throwing', () => {
    expect(() => renderMarkdown(null)).not.toThrow();
    expect(() => renderMarkdown(undefined)).not.toThrow();
    expect(renderMarkdown(null)).toBe('');
    expect(renderMarkdown(undefined)).toBe('');
  });
});
