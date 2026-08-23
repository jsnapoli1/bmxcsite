/**
 * Minimal JSONC reader, used by the `--remote` seed path.
 *
 * Lives in its own module so it can be imported by a test. It cannot be read
 * out of seed-content.js at test time: the suite runs inside the Workers
 * runtime, which has no filesystem.
 */
export /**
 * Strips comments from a JSONC document so JSON.parse can read it.
 *
 * wrangler.jsonc is heavily commented on purpose — those comments explain
 * why custom domains and the single-input build are configured as they are —
 * so this cannot just JSON.parse the file. String-aware: a `//` inside a
 * quoted value (a URL, for instance) is left alone.
 */
function stripJsonComments(text) {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (ch === '\n') { inLine = false; out += ch; }
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') { inBlock = false; i += 1; }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\') { out += text[i + 1] ?? ''; i += 1; continue; }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; out += ch; continue; }
    if (ch === '/' && next === '/') { inLine = true; i += 1; continue; }
    if (ch === '/' && next === '*') { inBlock = true; i += 1; continue; }
    out += ch;
  }
  // Trailing commas are legal in JSONC, not in JSON.
  return out.replace(/,(\s*[}\]])/g, '$1');
}
