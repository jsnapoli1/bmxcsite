import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';

/**
 * The development-only clock override.
 *
 * Registration runs January to June, so for half the year the open-window
 * path cannot be exercised at all — including in a browser, which is how
 * this repo's real bugs get found. The override makes that testable.
 *
 * The whole value of these tests is the negative cases: it must be
 * impossible for a production request to move the camp's pricing clock.
 */

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
});

async function post(testEnv, url = 'https://bmxc.camp/api/registration') {
  return app.fetch(new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ camperName: 'Clock Test' }),
  }), testEnv);
}

describe('with no override set', () => {
  it('uses the real clock', async () => {
    // September: the window is closed, and nothing should pretend it is not.
    const res = await post(env);
    const body = await res.json();
    expect(body.registrationOpen).toBe(false);
  });
});

describe('with the override set, on localhost', () => {
  it('opens the window so the priced path can be driven', async () => {
    const testEnv = { ...env, REGISTRATION_TODAY: '2026-01-15' };
    const res = await post(testEnv, 'http://localhost:8788/api/registration');
    const body = await res.json();
    expect(body.registrationOpen).toBe(true);
    expect(body.quote.tier).toBe('Early Bird');
  });

  it('honours the date it was given, not just any date', async () => {
    const testEnv = { ...env, REGISTRATION_TODAY: '2026-05-15' };
    const res = await post(testEnv, 'http://localhost:8788/api/registration');
    expect((await res.json()).quote.tier).toBe('Late Rate');
  });
});

describe('the override cannot reach production', () => {
  it('is ignored on a non-local hostname even if the var is set', async () => {
    // The var could only be set by someone with deploy access, but a
    // misconfiguration must not silently reprice the camp. Two locks.
    const testEnv = { ...env, REGISTRATION_TODAY: '2026-01-15' };
    const res = await post(testEnv, 'https://bmxc.camp/api/registration');
    expect((await res.json()).registrationOpen).toBe(false);
  });

  it('is ignored on the www host too', async () => {
    const testEnv = { ...env, REGISTRATION_TODAY: '2026-01-15' };
    const res = await post(testEnv, 'https://www.bmxc.camp/api/registration');
    expect((await res.json()).registrationOpen).toBe(false);
  });

  it('ignores a malformed date rather than crashing', async () => {
    const testEnv = { ...env, REGISTRATION_TODAY: 'not-a-date' };
    const res = await post(testEnv, 'http://localhost:8788/api/registration');
    expect(res.status).toBe(201);
    expect((await res.json()).registrationOpen).toBe(false);
  });

  it('is not fooled by a hostname that merely contains localhost', async () => {
    const testEnv = { ...env, REGISTRATION_TODAY: '2026-01-15' };
    const res = await post(testEnv, 'https://localhost.bmxc.camp/api/registration');
    expect((await res.json()).registrationOpen).toBe(false);
  });
});
