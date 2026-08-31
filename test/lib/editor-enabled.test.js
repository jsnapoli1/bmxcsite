import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

/**
 * vedit renders its editor UI only when the provider's `isEnabled` is true,
 * and `isEnabled = enabled ?? defaultEnabled()`. defaultEnabled() is true on
 * localhost, in a NODE_ENV=development build, or with `?vedit=1` in the URL —
 * none of which hold on bmxc.camp.
 *
 * Omitting the prop passed every local test and rendered nothing in
 * production, while `useVeditEditing` kept reporting `editing = true` because
 * it only writes to the store. The failure was invisible precisely because
 * localhost takes the other branch.
 *
 * Asserted against the built bundle rather than the source: what matters is
 * what ships, and the Workers test runtime has no filesystem or DOM to render
 * the component with. `npm run pretest` builds before this runs.
 */
async function asset(pathname) {
  const res = await env.ASSETS.fetch(new Request(`https://bmxc.camp${pathname}`));
  return res.ok ? res.text() : null;
}

async function editorChunk() {
  const html = await asset('/index.html');
  const entry = html.match(/\/assets\/index-[A-Za-z0-9_-]+\.js/)?.[0];
  const source = await asset(entry);
  const name = source.match(/visual-editor-provider-[A-Za-z0-9_-]+\.js/)?.[0];
  return name ? asset(`/assets/${name}`) : null;
}

describe('the shipped editor provider', () => {
  it('passes `enabled` rather than relying on vedit’s hostname default', async () => {
    const chunk = await editorChunk();
    expect(chunk).toBeTruthy();

    // Minified, so match the prop as emitted: `enabled:!0` for a literal
    // true, or `enabled:` followed by anything that isn't `void 0`.
    expect(chunk).toMatch(/enabled:\s*!0/);
    expect(chunk).not.toMatch(/enabled:\s*void 0/);
  });

  it('still passes the page list and a document key', async () => {
    const chunk = await editorChunk();
    expect(chunk).toMatch(/documentKey:/);
    expect(chunk).toMatch(/pages:/);
  });
});
