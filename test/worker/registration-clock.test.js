import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';

/**
 * The development-only clock override.
 *
 * Registration runs January to June, so for half the year the open-window
 * path cannot be exercised at all — including in a browser, which is how
 * this repo's real bugs get found.
 *
 * The gate is DEV_MODE, not the hostname: `wrangler dev` rewrites the
 * request URL to the configured route host, so a Worker on localhost sees
 * `bmxc.camp`. A hostname check looked safe and was simply broken.
 *
 * The negative cases below are the point of this file — it must be
 * impossible for a deployed Worker to move the camp's pricing clock.
 */

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM payments').run();
  await env.DB.prepare('DELETE FROM registrations').run();
});

async function post(testEnv) {
  return app.fetch(new Request('https://bmxc.camp/api/registration', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ camperName: 'Clock Test' }),
  }), testEnv);
}

describe('with no override set', () => {
  it('uses the real clock', async () => {
    // September: the window is closed, and nothing should pretend otherwise.
    expect((await (await post(env)).json()).registrationOpen).toBe(false);
  });
});

describe('with both vars set', () => {
  it('opens the window so the priced path can be driven', async () => {
    const testEnv = { ...env, DEV_MODE: 'true', REGISTRATION_TODAY: '2026-01-15' };
    const body = await (await post(testEnv)).json();
    expect(body.registrationOpen).toBe(true);
    expect(body.quote.tier).toBe('Early Bird');
  });

  it('honours the date it was given, not just any date', async () => {
    const testEnv = { ...env, DEV_MODE: 'true', REGISTRATION_TODAY: '2026-05-15' };
    expect((await (await post(testEnv)).json()).quote.tier).toBe('Late Rate');
  });
});

describe('the override cannot reach production', () => {
  it('is ignored when DEV_MODE is absent', async () => {
    // The deployed shape: REGISTRATION_TODAY could only arrive by someone
    // adding it to wrangler.jsonc, and even then it does nothing alone.
    const testEnv = { ...env, REGISTRATION_TODAY: '2026-01-15' };
    expect((await (await post(testEnv)).json()).registrationOpen).toBe(false);
  });

  it('is ignored when DEV_MODE is anything but the literal "true"', async () => {
    for (const value of ['1', 'yes', 'TRUE', 'true ', '']) {
      const testEnv = { ...env, DEV_MODE: value, REGISTRATION_TODAY: '2026-01-15' };
      // eslint-disable-next-line no-await-in-loop
      const body = await (await post(testEnv)).json();
      expect(body.registrationOpen, `DEV_MODE=${JSON.stringify(value)}`).toBe(false);
    }
  });

  it('ignores a malformed date rather than crashing', async () => {
    const testEnv = { ...env, DEV_MODE: 'true', REGISTRATION_TODAY: 'not-a-date' };
    const res = await post(testEnv);
    expect(res.status).toBe(201);
    expect((await res.json()).registrationOpen).toBe(false);
  });
});

describe('the deployed configuration', () => {
  it('does not define DEV_MODE', () => {
    // The whole guarantee rests on this: DEV_MODE can only come from
    // .dev.vars, which is gitignored and never uploaded.
    //
    // Asserted against the env the test runtime builds from
    // wrangler.jsonc, rather than by reading that file — the Workers
    // runtime cannot read arbitrary files, and this checks the value the
    // Worker would actually see, which is the thing that matters.
    expect(env.DEV_MODE).toBeUndefined();
  });
});
