import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import { confirmationEmail } from '../../worker/email/confirmation.js';

/**
 * The confirmation email is the one message this application sends. It is
 * transactional — the recipient asked for it seconds earlier — which is
 * what makes it appropriate for Cloudflare Email Service at all.
 */

function withEmail(sendImpl) {
  return { ...env, EMAIL: { send: vi.fn(sendImpl) } };
}

async function subscribe(testEnv, email) {
  return app.fetch(
    new Request('https://bmxc.camp/api/subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
    testEnv,
  );
}

describe('confirmationEmail', () => {
  const built = confirmationEmail({
    to: 'parent@example.com',
    token: 'tok123',
    origin: 'https://bmxc.camp',
  });

  it('sends from the onboarded apex domain', () => {
    // Sending is enabled on bmxc.camp itself, not a subdomain. A from
    // address on any other domain is refused as E_SENDER_NOT_VERIFIED.
    expect(built.from.email.endsWith('@bmxc.camp')).toBe(true);
  });

  it('carries both html and text', () => {
    // Text-only clients show the text part, and its absence hurts spam
    // scoring even for clients that render the HTML.
    expect(built.html).toContain('tok123');
    expect(built.text).toContain('tok123');
  });

  it('links to the confirm route with the token', () => {
    expect(built.html).toContain('https://bmxc.camp/api/subscribe/confirm?token=tok123');
  });

  it('offers one-click unsubscribe in the headers', () => {
    // Gmail and Yahoo require this on bulk-ish mail, and it is the
    // difference between someone unsubscribing and someone reporting spam.
    expect(built.headers['List-Unsubscribe'])
      .toBe('<https://bmxc.camp/api/unsubscribe?token=tok123>');
    expect(built.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
  });

  it('also puts an unsubscribe link in the body', () => {
    expect(built.text).toContain('/api/unsubscribe?token=tok123');
  });

  it('escapes the address rather than interpolating it raw', () => {
    // The address reaches this from an unauthenticated public endpoint.
    const nasty = confirmationEmail({
      to: '"><script>alert(1)</script>@example.com',
      token: 't',
      origin: 'https://bmxc.camp',
    });
    expect(nasty.html).not.toContain('<script>');
  });
});

describe('POST /api/subscribe sends the confirmation', () => {
  it('sends to the address that subscribed', async () => {
    const testEnv = withEmail(async () => ({ messageId: 'm1' }));
    await subscribe(testEnv, 'sends@example.com');

    expect(testEnv.EMAIL.send).toHaveBeenCalledTimes(1);
    expect(testEnv.EMAIL.send.mock.calls[0][0].to).toBe('sends@example.com');
  });

  it('sends the token that was actually stored', async () => {
    const testEnv = withEmail(async () => ({ messageId: 'm2' }));
    await subscribe(testEnv, 'token-match@example.com');

    const row = await env.DB.prepare(
      "SELECT token FROM subscribers WHERE email = 'token-match@example.com'",
    ).first();
    expect(testEnv.EMAIL.send.mock.calls[0][0].html).toContain(row.token);
  });

  it('keeps the subscription when the send fails', async () => {
    // The row is the durable record. Losing it because a transient send
    // failed would mean the person cannot confirm and cannot retry
    // without noticing nothing happened.
    const testEnv = withEmail(async () => { throw new Error('E_RATE_LIMIT_EXCEEDED'); });
    const res = await subscribe(testEnv, 'send-failed@example.com');

    expect(res.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT status FROM subscribers WHERE email = 'send-failed@example.com'",
    ).first();
    expect(row.status).toBe('pending');
  });

  it('answers identically whether the send succeeded or failed', async () => {
    // The uniform answer exists so this endpoint cannot be used to probe
    // who is on the list. A send failure must not break that.
    const okEnv = withEmail(async () => ({ messageId: 'm3' }));
    const okRes = await subscribe(okEnv, 'uniform-ok@example.com');

    const failEnv = withEmail(async () => { throw new Error('boom'); });
    const failRes = await subscribe(failEnv, 'uniform-fail@example.com');

    expect(await failRes.text()).toBe(await okRes.text());
    expect(failRes.status).toBe(okRes.status);
  });

  it('does not send when the address is invalid', async () => {
    const testEnv = withEmail(async () => ({ messageId: 'm4' }));
    const res = await subscribe(testEnv, 'not-an-email');

    expect(res.status).toBe(400);
    expect(testEnv.EMAIL.send).not.toHaveBeenCalled();
  });

  it('still works when no EMAIL binding is configured', async () => {
    // Local `wrangler dev` without the binding, and every existing test in
    // this suite, must not start failing because a send is attempted.
    const res = await subscribe({ ...env, EMAIL: undefined }, 'no-binding@example.com');
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(
      "SELECT status FROM subscribers WHERE email = 'no-binding@example.com'",
    ).first();
    expect(row.status).toBe('pending');
  });
});
