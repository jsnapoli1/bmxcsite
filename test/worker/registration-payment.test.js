import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import { signPayload } from '../../worker/registration/stripe.js';

const SECRET = 'whsec_test';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
  await env.DB.prepare("DELETE FROM campers WHERE created_by = 'registration'").run();
});

afterEach(() => vi.restoreAllMocks());

const withStripe = () => ({
  ...env,
  STRIPE_SECRET_KEY: 'sk_test',
  STRIPE_WEBHOOK_SECRET: SECRET,
});

async function newDraft(testEnv, fields = {}) {
  const res = await app.fetch(new Request('https://bmxc.camp/api/registration', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ camperName: 'Alex', guardianEmail: 'g@x.com', ...fields }),
  }), testEnv);
  return (await res.json()).reference;
}

async function postWebhook(testEnv, event, { secret = SECRET, timestamp } = {}) {
  const body = JSON.stringify(event);
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const signature = await signPayload(`${ts}.${body}`, secret);
  return app.fetch(new Request('https://bmxc.camp/api/registration/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${ts},v1=${signature}`,
    },
    body,
  }), testEnv);
}

function completedEvent(reference, sessionId = 'cs_test_1') {
  return {
    id: 'evt_1',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_intent: 'pi_1',
        amount_total: 25000,
        metadata: { reference },
      },
    },
  };
}

describe('without Stripe configured', () => {
  it('says checkout is unavailable rather than failing obscurely', async () => {
    const reference = await newDraft(env);
    const res = await app.fetch(new Request(
      `https://bmxc.camp/api/registration/${reference}/checkout`,
      { method: 'POST' },
    ), env);
    expect(res.status).toBe(503);
  });
});

describe('the webhook signature', () => {
  it('confirms a registration when the signature is valid', async () => {
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);

    const res = await postWebhook(testEnv, completedEvent(reference));
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(
      'SELECT status, deposit_paid_cents FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.status).toBe('confirmed');
    expect(row.deposit_paid_cents).toBe(25000);
  });

  it('rejects a forged signature and changes nothing', async () => {
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);

    const res = await postWebhook(testEnv, completedEvent(reference), { secret: 'whsec_wrong' });
    expect(res.status).toBe(400);

    const row = await env.DB.prepare(
      'SELECT status FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.status).toBe('draft');
  });

  it('rejects a missing signature header', async () => {
    const testEnv = withStripe();
    const res = await app.fetch(new Request('https://bmxc.camp/api/registration/webhook', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(completedEvent('X')),
    }), testEnv);
    expect(res.status).toBe(400);
  });

  it('rejects a replayed old timestamp', async () => {
    // Stripe's own guidance: a signature valid forever is a replay
    // waiting to happen.
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);
    const old = Math.floor(Date.now() / 1000) - 60 * 60;

    const res = await postWebhook(testEnv, completedEvent(reference), { timestamp: old });
    expect(res.status).toBe(400);

    const row = await env.DB.prepare(
      'SELECT status FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.status).toBe('draft');
  });

  it('rejects a body altered after signing', async () => {
    // The signature is over the exact bytes. Swapping the amount after
    // signing must not verify.
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);
    const event = completedEvent(reference);
    const body = JSON.stringify(event);
    const ts = Math.floor(Date.now() / 1000);
    const signature = await signPayload(`${ts}.${body}`, SECRET);

    const tampered = body.replace('25000', '1');
    const res = await app.fetch(new Request('https://bmxc.camp/api/registration/webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${ts},v1=${signature}`,
      },
      body: tampered,
    }), testEnv);

    expect(res.status).toBe(400);
  });
});

describe('webhook idempotency', () => {
  it('a repeated event does not pay twice', async () => {
    const testEnv = withStripe();
    const reference = await newDraft(testEnv);

    await postWebhook(testEnv, completedEvent(reference));
    const second = await postWebhook(testEnv, completedEvent(reference));
    expect(second.status).toBe(200);

    const { results } = await env.DB.prepare('SELECT * FROM payments').all();
    expect(results).toHaveLength(1);

    const row = await env.DB.prepare(
      'SELECT deposit_paid_cents FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.deposit_paid_cents).toBe(25000);
  });
});

describe('confirming writes the camper roster', () => {
  it('records consent only when the guardian gave it', async () => {
    const testEnv = withStripe();

    const yesRef = await newDraft(testEnv, { camperName: 'Consented', photoConsent: true });
    await postWebhook(testEnv, completedEvent(yesRef, 'cs_yes'));

    const noRef = await newDraft(testEnv, { camperName: 'Not consented', photoConsent: false });
    await postWebhook(testEnv, completedEvent(noRef, 'cs_no'));

    const consented = await env.DB.prepare(
      "SELECT consent_at FROM campers WHERE name = 'Consented'",
    ).first();
    const notConsented = await env.DB.prepare(
      "SELECT consent_at FROM campers WHERE name = 'Not consented'",
    ).first();

    expect(consented?.consent_at).toBeGreaterThan(0);
    expect(notConsented).not.toBeNull();
    expect(notConsented.consent_at).toBeNull();
  });

  it('a camper without consent cannot be enrolled for face tagging', async () => {
    // The end-to-end property: registration is where consent is captured,
    // and worker/faces/roster.js is what refuses to enroll without it.
    const { mayEnroll } = await import('../../worker/faces/roster.js');
    const testEnv = withStripe();

    const noRef = await newDraft(testEnv, { camperName: 'Silent', photoConsent: false });
    await postWebhook(testEnv, completedEvent(noRef, 'cs_silent'));

    expect(await mayEnroll(env.DB, `reg-${noRef}`)).toBe(false);
  });
});

describe('an unknown reference in an event', () => {
  it('is acknowledged rather than retried forever', async () => {
    // Returning an error would make Stripe retry an event that can never
    // succeed.
    const testEnv = withStripe();
    const res = await postWebhook(testEnv, completedEvent('NOSUCHREF'));
    expect(res.status).toBe(200);
  });
});

describe('route ordering', () => {
  it('does not treat "webhook" as a registration reference', async () => {
    // /webhook is registered after /:reference. A GET must not look up a
    // registration called "webhook".
    const res = await app.fetch(
      new Request('https://bmxc.camp/api/registration/webhook'),
      withStripe(),
    );
    expect(res.status).toBe(404);
  });
});
