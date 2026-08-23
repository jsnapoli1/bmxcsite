import MarkdownIt from 'markdown-it';

// Blog post bodies are authored by camp staff as Markdown and rendered into
// pages anyone on the internet reads. Markdown renderers are a classic XSS
// vector, so every option here is chosen to remove a class of attack rather
// than to filter it after the fact.
//
//   html: false        — raw HTML is refused at the parser, not sanitised
//                         afterwards. There is no HTML sanitiser in this
//                         file because there is no HTML to sanitise: any
//                         `<tag>` typed into a post body is escaped to
//                         visible text (`&lt;tag&gt;`), full stop.
//   linkify: false      — bare URLs are never auto-linked. Only an explicit
//                         [text](url) becomes a link, so a pasted string
//                         (including a pasted URL with a hostile scheme)
//                         can't silently become a clickable link.
//   typographer: false  — punctuation passes through untouched. The camp's
//                         em-dashes and curly quotes are their own voice
//                         (see CLAUDE.md) and must not be rewritten.
const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
});

// Schemes allowed to render as an actual <a href>. Anything else (in
// particular `javascript:`, `data:`, and `vbscript:`) renders as plain
// text instead of a link. markdown-it already refuses `javascript:` itself
// by default, but that default is an implementation detail of a dependency
// we don't control — this allowlist is enforced here explicitly so a future
// markdown-it upgrade or config change can't silently reopen the hole.
const ALLOWED_LINK_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * Returns true if `href` uses one of ALLOWED_LINK_SCHEMES.
 * Anything unparsable (relative paths, malformed URLs, etc.) is rejected
 * rather than guessed at.
 */
function hasAllowedScheme(href) {
  if (typeof href !== 'string' || href.length === 0) {
    return false;
  }

  try {
    // A base is supplied so scheme-relative/relative strings still parse;
    // what we actually gate on is `protocol`, which URL always lower-cases.
    const url = new URL(href, 'https://bmxc.camp');
    return ALLOWED_LINK_SCHEMES.includes(url.protocol);
  } catch {
    return false;
  }
}

const defaultLinkOpenRenderer =
  md.renderer.rules.link_open ||
  function renderToken(tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_open = function renderHardenedLink(
  tokens,
  idx,
  options,
  env,
  self,
) {
  const token = tokens[idx];
  const href = token.attrGet('href');

  if (!hasAllowedScheme(href)) {
    // Disallowed scheme: strip the link entirely. The matching link_close
    // is suppressed below so the surrounding text renders as plain text
    // instead of an anchor with no href.
    token.attrSet('data-stripped-link', 'true');
    return '';
  }

  token.attrSet('rel', 'noopener noreferrer');
  token.attrSet('target', '_blank');

  return defaultLinkOpenRenderer(tokens, idx, options, env, self);
};

const defaultLinkCloseRenderer =
  md.renderer.rules.link_close ||
  function renderToken(tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options);
  };

md.renderer.rules.link_close = function renderHardenedLinkClose(
  tokens,
  idx,
  options,
  env,
  self,
) {
  // Walk back to the matching link_open to see whether it was stripped.
  let depth = 0;
  for (let i = idx - 1; i >= 0; i -= 1) {
    if (tokens[i].type === 'link_close') {
      depth += 1;
    } else if (tokens[i].type === 'link_open') {
      if (depth === 0) {
        if (tokens[i].attrGet('data-stripped-link')) {
          return '';
        }
        break;
      }
      depth -= 1;
    }
  }

  return defaultLinkCloseRenderer(tokens, idx, options, env, self);
};

/**
 * Renders staff-authored Markdown to a safe HTML string.
 *
 * Safe here specifically means: raw HTML is disabled at the parser (html:
 * false above), so nothing in the returned string can be a tag the author
 * typed directly — it is all markdown-it-generated markup from a fixed,
 * known set of block/inline rules. That is what makes it acceptable for
 * the consuming component to use dangerouslySetInnerHTML on this output:
 * the HTML is renderer-controlled, not author-controlled. Do NOT re-enable
 * `html: true` above — doing so reopens raw HTML injection and turns that
 * dangerouslySetInnerHTML call into a real XSS vector.
 *
 * @param {string | null | undefined} markdown
 * @returns {string} HTML string, or '' for empty/null/undefined input.
 */
export function renderMarkdown(markdown) {
  if (markdown === null || markdown === undefined || markdown === '') {
    return '';
  }

  return md.render(String(markdown));
}
