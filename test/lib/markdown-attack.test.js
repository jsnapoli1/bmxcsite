import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../../src/lib/markdown.js';

/**
 * Blog bodies are written by camp staff and rendered into pages anyone can
 * read. These are the payloads an attacker would actually try. Raw HTML is
 * off at the parser, so none of them should survive as live markup.
 */
const PAYLOADS = [
  ['script tag',          '<script>alert(1)</script>'],
  ['img onerror',         '<img src=x onerror="alert(1)">'],
  ['svg onload',          '<svg onload=alert(1)>'],
  ['iframe',              '<iframe src="https://evil.test"></iframe>'],
  ['body onload',         '<body onload=alert(1)>'],
  ['style expression',    '<style>body{background:url("javascript:alert(1)")}</style>'],
  ['js link',             '[x](javascript:alert(1))'],
  ['JS uppercase',        '[x](JaVaScRiPt:alert(1))'],
  ['js with whitespace',  '[x](java\tscript:alert(1))'],
  ['data html',           '[x](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)'],
  ['vbscript',            '[x](vbscript:msgbox(1))'],
  ['file scheme',         '[x](file:///etc/passwd)'],
  ['image js src',        '![alt](javascript:alert(1))'],
  ['html entity script',  '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ['nested backtick',     '`<script>alert(1)</script>`'],
];

describe('markdown cannot emit executable markup', () => {
  it.each(PAYLOADS)('%s produces no live script or handler', (_label, input) => {
    const out = renderMarkdown(input);
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/<iframe/i);
    // An event handler only matters inside a LIVE tag. markdown-it escapes
    // the whole tag (`&lt;img ... onerror=...&gt;`), so the handler text is
    // inert. Assert no live tag opens at all, which is the stronger claim.
    expect(out).not.toMatch(/<(?!\/?(p|a|h[1-6]|ul|ol|li|em|strong|code|pre|blockquote|br|hr|img)\b)[a-z]/i);
    expect(out).not.toMatch(/<[a-z][^>]*\son\w+\s*=/i);   // handler in a live tag
    expect(out).not.toMatch(/href\s*=\s*["']?\s*javascript:/i);
    expect(out).not.toMatch(/href\s*=\s*["']?\s*vbscript:/i);
    expect(out).not.toMatch(/href\s*=\s*["']?\s*data:/i);
    expect(out).not.toMatch(/src\s*=\s*["']?\s*javascript:/i);
  });

  it('a legitimate link survives, hardened', () => {
    const out = renderMarkdown('[camp](https://bmxc.camp)');
    expect(out).toContain('href="https://bmxc.camp"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('mailto survives', () => {
    expect(renderMarkdown('[mail](mailto:info@bmxc.camp)')).toContain('mailto:info@bmxc.camp');
  });

  it("the camp's punctuation survives byte for byte", () => {
    const src = 'Camp — since 1969 — uses ’curly’ quotes and “doubles”.';
    const out = renderMarkdown(src);
    expect(out).toContain('—');
    expect(out).toContain('’curly’');
    expect(out).toContain('“doubles”');
  });

  it('empty, null and undefined do not throw', () => {
    expect(() => renderMarkdown('')).not.toThrow();
    expect(() => renderMarkdown(null)).not.toThrow();
    expect(() => renderMarkdown(undefined)).not.toThrow();
  });
});
