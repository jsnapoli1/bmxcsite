import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';

/**
 * A browser navigating to these routes must get HTML.
 *
 * Not cosmetic. `not_found_handling: "single-page-application"` makes the
 * static-asset layer answer a navigation it does not recognise with
 * index.html, and React Router then renders "Page not found". A confirm
 * link in an email is always a navigation, so a JSON-only route is a 404
 * to every real person who clicks it — while curl reports 200 and looks
 * fine. That is exactly how this shipped broken once.
 */

const BROWSER = { Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };

async function get(path, headers = {}) {
  return app.fetch(new Request(`https://bmxc.camp${path}`, { headers }), env);
}

async function seedToken(email) {
  await app.fetch(new Request('https://bmxc.camp/api/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  }), env);
  const row = await env.DB.prepare('SELECT token FROM subscribers WHERE email = ?')
    .bind(email).first();
  return row.token;
}

describe('confirm, in a browser', () => {
  it('answers with HTML, not JSON', async () => {
    const token = await seedToken('page-confirm@example.com');
    const res = await get(`/api/subscribe/confirm?token=${token}`, BROWSER);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    const html = await res.text();
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toContain('{"ok"');
  });

  it('still confirms the subscription', async () => {
    // The page is presentation. It must not change what the route does.
    const token = await seedToken('page-works@example.com');
    await get(`/api/subscribe/confirm?token=${token}`, BROWSER);

    const row = await env.DB.prepare(
      "SELECT status FROM subscribers WHERE email = 'page-works@example.com'",
    ).first();
    expect(row.status).toBe('confirmed');
  });

  it('offers a way back to the site', async () => {
    const token = await seedToken('page-link@example.com');
    const html = await (await get(`/api/subscribe/confirm?token=${token}`, BROWSER)).text();
    expect(html).toContain('href="/"');
  });
});

describe('unsubscribe, in a browser', () => {
  it('answers with HTML', async () => {
    const token = await seedToken('page-unsub@example.com');
    const res = await get(`/api/unsubscribe?token=${token}`, BROWSER);

    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<!doctype html>');
  });

  it('still unsubscribes', async () => {
    const token = await seedToken('page-unsub-works@example.com');
    await get(`/api/unsubscribe?token=${token}`, BROWSER);

    const row = await env.DB.prepare(
      "SELECT status FROM subscribers WHERE email = 'page-unsub-works@example.com'",
    ).first();
    expect(row.status).toBe('unsubscribed');
  });
});

describe('programmatic callers keep JSON', () => {
  it('confirm answers JSON without an html Accept', async () => {
    const token = await seedToken('json-confirm@example.com');
    const res = await get(`/api/subscribe/confirm?token=${token}`, { Accept: 'application/json' });

    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.json()).toHaveProperty('ok', true);
  });

  it('confirm answers JSON with no Accept header at all', async () => {
    const token = await seedToken('json-noaccept@example.com');
    const res = await get(`/api/subscribe/confirm?token=${token}`);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('unsubscribe answers JSON for an API caller', async () => {
    const token = await seedToken('json-unsub@example.com');
    const res = await get(`/api/unsubscribe?token=${token}`, { Accept: 'application/json' });
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('a stale token still reads as success', () => {
  it('does not tell a browser the token was unknown', async () => {
    // Same reason the JSON is uniform: a different page for an unknown
    // token would say whether that address is on the list. It also spares
    // someone who clicked an older email a false alarm.
    const res = await get('/api/subscribe/confirm?token=definitely-not-real', BROWSER);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).not.toMatch(/not found|invalid|expired/i);
  });
});
