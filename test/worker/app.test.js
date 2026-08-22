import { describe, it, expect } from 'vitest';
import { env, SELF } from 'cloudflare:test';
import app from '../../worker/app.js';

describe('worker app', () => {
  it('serves the static site at /', async () => {
    const res = await app.fetch(new Request('https://bmxc.camp/'), env);
    expect(res.status).toBe(200);
  });

  it('returns 404 JSON for an unknown API route', async () => {
    const res = await app.fetch(
      new Request('https://bmxc.camp/api/nope'),
      env,
    );
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});
