import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
});

afterEach(() => vi.useRealTimers());

/**
 * Pin the clock inside the registration window.
 *
 * Without this the quote tests pass only between January and June, and
 * would have started failing on their own in July — a test whose result
 * depends on the month it is run is not a test. The closed case gets its
 * own block below.
 */
function duringRegistration() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
}

async function call(method, path, body) {
  return app.fetch(new Request(`https://bmxc.camp${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  }), env);
}

describe('starting a registration', () => {
  it('needs no sign-in', async () => {
    const res = await call('POST', '/api/registration', { camperName: 'Alex' });
    expect(res.status).toBe(201);
    expect((await res.json()).reference).toBeTruthy();
  });

  it('returns a quote the server computed', async () => {
    duringRegistration();
    const res = await call('POST', '/api/registration', { camperName: 'Alex' });
    const body = await res.json();
    expect(body.registrationOpen).toBe(true);
    expect(body.quote.depositCents).toBe(25000);
  });
});

describe('a client cannot choose its own price', () => {
  it('ignores a total sent in the body', async () => {
    const created = await call('POST', '/api/registration', {
      camperName: 'Cheapskate', totalCents: 1, total_cents: 1,
    });
    const { reference } = await created.json();
    const row = await env.DB.prepare(
      'SELECT total_cents FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.total_cents).not.toBe(1);
  });

  it('ignores a status sent in the body', async () => {
    const created = await call('POST', '/api/registration', {
      camperName: 'Sneaky', status: 'confirmed',
    });
    const { reference } = await created.json();
    const row = await env.DB.prepare(
      'SELECT status FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.status).toBe('draft');
  });

  it('ignores a paid amount sent in the body', async () => {
    const created = await call('POST', '/api/registration', {
      camperName: 'Sneaky', depositPaidCents: 25000,
    });
    const { reference } = await created.json();
    const row = await env.DB.prepare(
      'SELECT deposit_paid_cents FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.deposit_paid_cents).toBe(0);
  });
});

describe('continuing a registration', () => {
  it('updates by reference', async () => {
    const { reference } = await (await call('POST', '/api/registration', { camperName: 'A' })).json();
    const res = await call('PATCH', `/api/registration/${reference}`, { busRoute: 'ny' });
    expect(res.status).toBe(200);
    expect((await res.json()).registration.bus_route).toBe('ny');
  });

  it('reprices when the bus changes', async () => {
    duringRegistration();
    const { reference } = await (await call('POST', '/api/registration', { camperName: 'A' })).json();
    const res = await call('PATCH', `/api/registration/${reference}`, { busRoute: 'ny' });
    const { quote } = await res.json();
    expect(quote.busCents).toBe(12500);
  });

  it('404s an unknown reference', async () => {
    expect((await call('PATCH', '/api/registration/NOPE', { busRoute: 'ny' })).status).toBe(404);
  });

  it('uses a reference long enough to resist guessing', async () => {
    const { reference } = await (await call('POST', '/api/registration', { camperName: 'A' })).json();
    expect(reference.length).toBeGreaterThanOrEqual(8);
  });
});

describe('reading a registration', () => {
  it('returns it with a fresh quote', async () => {
    duringRegistration();
    const { reference } = await (await call('POST', '/api/registration', {
      camperName: 'A', busRoute: 'nj',
    })).json();
    const res = await call('GET', `/api/registration/${reference}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registration.camper_name).toBe('A');
    expect(body.quote.busCents).toBe(10000);
  });
});

describe('a browser navigating to these routes', () => {
  it('is not the SPA 404', async () => {
    // run_worker_first covers /api/*, but a test pins it: this repo has
    // already shipped a public route that 404'd for every real click.
    const { reference } = await (await call('POST', '/api/registration', { camperName: 'A' })).json();
    const res = await app.fetch(new Request(
      `https://bmxc.camp/api/registration/${reference}`,
      { headers: { Accept: 'text/html', 'Sec-Fetch-Mode': 'navigate' } },
    ), env);
    expect(res.status).toBe(200);
  });
});

describe('when registration is closed for the year', () => {
  it('says so rather than showing a blank price', async () => {
    // August is past the end of June. The pricing module refuses to
    // invent a tier, and the API must pass that through as a state a
    // form can render, not an error or an empty object.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));

    const res = await call('POST', '/api/registration', { camperName: 'Too late' });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.registrationOpen).toBe(false);
    expect(body.quote).toBeNull();
  });

  it('still records the draft, so nobody loses what they typed', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-01T12:00:00Z'));

    const { reference } = await (await call('POST', '/api/registration', {
      camperName: 'Too late',
    })).json();
    const row = await env.DB.prepare(
      'SELECT camper_name FROM registrations WHERE reference = ?',
    ).bind(reference).first();
    expect(row.camper_name).toBe('Too late');
  });
});
