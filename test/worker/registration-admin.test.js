import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

async function seedUser(email, { registrations = false, campinfo = false } = {}) {
  await env.DB.prepare(
    'INSERT INTO users (email, can_registrations, can_campinfo) VALUES (?, ?, ?)',
  ).bind(email, registrations ? 1 : 0, campinfo ? 1 : 0).run();
  return email;
}

async function call(method, path) {
  return app.fetch(new Request(`https://bmxc.camp${path}`, { method }), env);
}

async function seedConfirmed(camperName, extra = {}) {
  await env.DB.prepare(
    `INSERT INTO registrations (reference, status, camper_name, guardian_email, total_cents, deposit_paid_cents)
     VALUES (?, 'confirmed', ?, ?, ?, ?)`,
  ).bind(
    extra.reference ?? `REF${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    camperName,
    extra.guardianEmail ?? 'g@x.com',
    extra.totalCents ?? 55500,
    extra.paidCents ?? 25000,
  ).run();
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
});

afterEach(() => vi.restoreAllMocks());

describe('the registrations permission', () => {
  it('refuses someone without it', async () => {
    asUser(await seedUser('r1@example.com', { registrations: false }));
    expect((await call('GET', '/api/admin/registrations')).status).toBe(403);
  });

  it('refuses someone who only has campinfo', async () => {
    // Its own area precisely so whoever edits the FAQ cannot read
    // guardians' contact details.
    asUser(await seedUser('r2@example.com', { campinfo: true }));
    expect((await call('GET', '/api/admin/registrations')).status).toBe(403);
  });

  it('allows someone holding it', async () => {
    asUser(await seedUser('r3@example.com', { registrations: true }));
    expect((await call('GET', '/api/admin/registrations')).status).toBe(200);
  });
});

describe('listing', () => {
  it('returns confirmed registrations by default', async () => {
    asUser(await seedUser('r4@example.com', { registrations: true }));
    await seedConfirmed('Alex Kim');

    const { registrations } = await (await call('GET', '/api/admin/registrations')).json();
    expect(registrations).toHaveLength(1);
    expect(registrations[0].camper_name).toBe('Alex Kim');
  });

  it('falls back to confirmed for an unrecognised status', async () => {
    asUser(await seedUser('r5@example.com', { registrations: true }));
    await seedConfirmed('Alex Kim');

    const res = await call('GET', '/api/admin/registrations?status=nonsense');
    expect(res.status).toBe(200);
    expect((await res.json()).registrations).toHaveLength(1);
  });
});

describe('the CSV export', () => {
  it('serves CSV with the registration columns', async () => {
    asUser(await seedUser('r6@example.com', { registrations: true }));
    await seedConfirmed('Alex Kim');

    const res = await call('GET', '/api/admin/registrations/export.csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');

    const csv = await res.text();
    expect(csv.split('\n')[0]).toContain('reference');
    expect(csv).toContain('Alex Kim');
  });

  it('neutralises a formula in a camper name', async () => {
    // Reuses the guard from worker/email/subscribers.js. A name starting
    // with = is executed on open by Excel and Sheets.
    asUser(await seedUser('r7@example.com', { registrations: true }));
    await seedConfirmed('=cmd|calc');

    const csv = await (await call('GET', '/api/admin/registrations/export.csv')).text();
    expect(csv).toContain("'=cmd|calc");
  });
});

describe('cancelling', () => {
  it('marks a registration cancelled and audits it', async () => {
    asUser(await seedUser('r8@example.com', { registrations: true }));
    await seedConfirmed('Leaving', { reference: 'CANCELME' });

    const res = await call('POST', '/api/admin/registrations/CANCELME/cancel');
    expect(res.status).toBe(200);

    const row = await env.DB.prepare(
      "SELECT status FROM registrations WHERE reference = 'CANCELME'",
    ).first();
    expect(row.status).toBe('cancelled');

    const audit = await env.DB.prepare(
      "SELECT * FROM audit_log WHERE action = 'registration.cancel' ORDER BY id DESC",
    ).first();
    expect(audit.detail).toBe('CANCELME');
  });

  it('404s an unknown reference', async () => {
    asUser(await seedUser('r9@example.com', { registrations: true }));
    expect((await call('POST', '/api/admin/registrations/NOPE/cancel')).status).toBe(404);
  });
});

describe('payment state is not writable here', () => {
  it('offers no route that changes what was paid', async () => {
    // Stripe and the webhook own this. A PATCH that set deposit_paid_cents
    // would let the database disagree with the money.
    asUser(await seedUser('r10@example.com', { registrations: true }));
    await seedConfirmed('Paid', { reference: 'PAIDREF' });

    const res = await app.fetch(new Request(
      'https://bmxc.camp/api/admin/registrations/PAIDREF',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deposit_paid_cents: 999999 }),
      },
    ), env);
    expect(res.status).toBe(404);

    const row = await env.DB.prepare(
      "SELECT deposit_paid_cents FROM registrations WHERE reference = 'PAIDREF'",
    ).first();
    expect(row.deposit_paid_cents).toBe(25000);
  });
});
