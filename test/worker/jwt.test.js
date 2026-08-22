import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK } from 'jose';
import { verifyAccessJwt, AuthError } from '../../worker/auth/jwt.js';

let privateKey;
let env;

beforeAll(async () => {
  const pair = await generateKeyPair('RS256', { extractable: true });
  privateKey = pair.privateKey;
  const jwk = await exportJWK(pair.publicKey);
  jwk.kid = 'test-key';
  jwk.alg = 'RS256';

  // Stand in for the Access certs endpoint.
  globalThis.fetch = async (input) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/cdn-cgi/access/certs')) {
      return new Response(JSON.stringify({ keys: [jwk] }), {
        headers: { 'content-type': 'application/json' },
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };

  env = {
    TEAM_DOMAIN: 'https://test.cloudflareaccess.com',
    POLICY_AUD: 'test-audience',
  };
});

function requestWithToken(token) {
  return new Request('https://bmxc.camp/api/admin/me', {
    headers: token ? { 'cf-access-jwt-assertion': token } : {},
  });
}

async function signToken(claims, overrides = {}) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
    .setIssuer(overrides.issuer ?? 'https://test.cloudflareaccess.com')
    .setAudience(overrides.audience ?? 'test-audience')
    .setExpirationTime(overrides.exp ?? '1h')
    .sign(privateKey);
}

describe('verifyAccessJwt', () => {
  it('returns the email from a valid token', async () => {
    const token = await signToken({ email: 'Ken@Example.com' });
    const email = await verifyAccessJwt(requestWithToken(token), env);
    expect(email).toBe('ken@example.com');
  });

  it('rejects a missing token', async () => {
    await expect(verifyAccessJwt(requestWithToken(null), env))
      .rejects.toBeInstanceOf(AuthError);
  });

  it('rejects a token for the wrong audience', async () => {
    const token = await signToken({ email: 'ken@example.com' },
      { audience: 'someone-elses-app' });
    await expect(verifyAccessJwt(requestWithToken(token), env))
      .rejects.toBeInstanceOf(AuthError);
  });

  it('rejects a token from the wrong issuer', async () => {
    const token = await signToken({ email: 'ken@example.com' },
      { issuer: 'https://evil.cloudflareaccess.com' });
    await expect(verifyAccessJwt(requestWithToken(token), env))
      .rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an expired token', async () => {
    const token = await signToken({ email: 'ken@example.com' },
      { exp: Math.floor(Date.now() / 1000) - 60 });
    await expect(verifyAccessJwt(requestWithToken(token), env))
      .rejects.toBeInstanceOf(AuthError);
  });

  it('rejects a valid token with no email claim', async () => {
    const token = await signToken({ sub: 'no-email-here' });
    await expect(verifyAccessJwt(requestWithToken(token), env))
      .rejects.toBeInstanceOf(AuthError);
  });
});
