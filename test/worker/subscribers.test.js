import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import {
  subscribe, confirm, unsubscribe, listSubscribers, toCsv, SubscriberError,
} from '../../worker/email/subscribers.js';

describe('subscribe', () => {
  it('stores a pending row with a token', async () => {
    const { token } = await subscribe(env.DB, 'parent@example.com');
    expect(token).toBeTruthy();
    const row = await env.DB.prepare(
      "SELECT * FROM subscribers WHERE email = 'parent@example.com'",
    ).first();
    expect(row.status).toBe('pending');
  });

  it('lowercases the address', async () => {
    await subscribe(env.DB, 'Mixed@Example.COM');
    const row = await env.DB.prepare(
      "SELECT * FROM subscribers WHERE email = 'mixed@example.com'",
    ).first();
    expect(row).not.toBeNull();
  });

  it('refuses something that is not an address', async () => {
    await expect(subscribe(env.DB, 'nope')).rejects.toThrow(SubscriberError);
  });

  it('does not reveal whether an address was already subscribed', async () => {
    // Returning a different result for a known address turns this public
    // endpoint into a way to test whether someone is on the list.
    const first = await subscribe(env.DB, 'twice@example.com');
    const second = await subscribe(env.DB, 'twice@example.com');
    expect(typeof second.token).toBe('string');
    expect(second.token).not.toBe(first.token);
  });

  it('re-subscribing someone who unsubscribed gives them a fresh token', async () => {
    const { token } = await subscribe(env.DB, 'back@example.com');
    await confirm(env.DB, token);
    await unsubscribe(env.DB, token);

    const again = await subscribe(env.DB, 'back@example.com');
    expect(await confirm(env.DB, again.token)).toBe(true);
  });

  it('invalidates the previous token', async () => {
    // The token is the unsubscribe handle too. A rotated token must not
    // leave an older link working.
    const first = await subscribe(env.DB, 'rotate@example.com');
    await subscribe(env.DB, 'rotate@example.com');
    expect(await confirm(env.DB, first.token)).toBe(false);
  });
});

describe('confirm', () => {
  it('moves a pending row to confirmed', async () => {
    const { token } = await subscribe(env.DB, 'c@example.com');
    expect(await confirm(env.DB, token)).toBe(true);
    const row = await env.DB.prepare("SELECT * FROM subscribers WHERE email = 'c@example.com'").first();
    expect(row.status).toBe('confirmed');
    expect(row.confirmed_at).toBeGreaterThan(0);
  });

  it('refuses an unknown token', async () => {
    expect(await confirm(env.DB, 'not-a-token')).toBe(false);
  });

  it('is idempotent', async () => {
    // Mail clients prefetch links. Confirming twice must not error.
    const { token } = await subscribe(env.DB, 'idem@example.com');
    expect(await confirm(env.DB, token)).toBe(true);
    expect(await confirm(env.DB, token)).toBe(true);
  });
});

describe('unsubscribe', () => {
  it('works without any sign-in and marks the row', async () => {
    const { token } = await subscribe(env.DB, 'u@example.com');
    await confirm(env.DB, token);
    expect(await unsubscribe(env.DB, token)).toBe(true);
    const row = await env.DB.prepare("SELECT * FROM subscribers WHERE email = 'u@example.com'").first();
    expect(row.status).toBe('unsubscribed');
  });

  it('is idempotent', async () => {
    const { token } = await subscribe(env.DB, 'u2@example.com');
    await unsubscribe(env.DB, token);
    expect(await unsubscribe(env.DB, token)).toBe(true);
  });

  it('reports false for an unknown token rather than throwing', async () => {
    expect(await unsubscribe(env.DB, 'bogus')).toBe(false);
  });

  it('works on a pending row too', async () => {
    // Someone who never confirmed can still say "stop emailing me".
    const { token } = await subscribe(env.DB, 'u3@example.com');
    expect(await unsubscribe(env.DB, token)).toBe(true);
  });
});

describe('listSubscribers', () => {
  it('returns only the requested status', async () => {
    const { token } = await subscribe(env.DB, 'listed@example.com');
    await confirm(env.DB, token);
    await subscribe(env.DB, 'notlisted@example.com');

    const rows = await listSubscribers(env.DB, { status: 'confirmed' });
    const emails = rows.map((r) => r.email);
    expect(emails).toContain('listed@example.com');
    expect(emails).not.toContain('notlisted@example.com');
  });

  it('never returns the token', async () => {
    // The token is an unsubscribe credential. It has no business in a
    // list rendered to an admin, still less in an exported CSV.
    const { token } = await subscribe(env.DB, 'tok@example.com');
    await confirm(env.DB, token);
    const rows = await listSubscribers(env.DB, { status: 'confirmed' });
    for (const row of rows) expect(row).not.toHaveProperty('token');
  });
});

describe('toCsv', () => {
  it('writes a header and one row per subscriber', () => {
    const csv = toCsv([{ email: 'a@b.c', confirmed_at: 1756900000 }]);
    expect(csv.split('\n')[0]).toBe('email,confirmed_at');
    expect(csv).toContain('a@b.c');
  });

  it('neutralises a formula so a spreadsheet does not execute it', () => {
    // An address beginning = + - @ is executed on open by Excel and
    // Sheets. This list is exported precisely so someone can open it.
    const csv = toCsv([{ email: '=cmd|calc', confirmed_at: 1 }]);
    expect(csv).toContain("'=cmd|calc");
  });

  it('quotes a value holding a comma', () => {
    const csv = toCsv([{ email: 'a,b@c.d', confirmed_at: 1 }]);
    expect(csv).toContain('"a,b@c.d"');
  });
});
