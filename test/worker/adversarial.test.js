import { describe, it, expect, beforeAll } from 'vitest';
import { SignJWT, generateKeyPair, exportJWK, UnsecuredJWT } from 'jose';
import { verifyAccessJwt, AuthError } from '../../worker/auth/jwt.js';

let goodKey, evilKey, env;

beforeAll(async () => {
  const good = await generateKeyPair('RS256', { extractable: true });
  const evil = await generateKeyPair('RS256', { extractable: true });
  goodKey = good.privateKey; evilKey = evil.privateKey;
  const jwk = await exportJWK(good.publicKey);
  jwk.kid = 'test-key'; jwk.alg = 'RS256';
  globalThis.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }),
    { headers: { 'content-type': 'application/json' } });
  env = { TEAM_DOMAIN: 'https://test.cloudflareaccess.com', POLICY_AUD: 'test-audience' };
});

const req = (t) => new Request('https://x/', { headers: { 'cf-access-jwt-assertion': t } });

describe('adversarial', () => {
  it('rejects a token signed by an attacker key', async () => {
    const t = await new SignJWT({ email: 'evil@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://test.cloudflareaccess.com')
      .setAudience('test-audience').setExpirationTime('1h').sign(evilKey);
    await expect(verifyAccessJwt(req(t), env)).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects an alg=none unsecured token', async () => {
    const t = new UnsecuredJWT({ email: 'evil@example.com' })
      .setIssuer('https://test.cloudflareaccess.com')
      .setAudience('test-audience').encode();
    await expect(verifyAccessJwt(req(t), env)).rejects.toBeInstanceOf(AuthError);
  });

  it('rejects a tampered payload', async () => {
    const t = await new SignJWT({ email: 'user@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://test.cloudflareaccess.com')
      .setAudience('test-audience').setExpirationTime('1h').sign(goodKey);
    const [h, , s] = t.split('.');
    const evilPayload = btoa(JSON.stringify({ email: 'admin@example.com',
      iss: 'https://test.cloudflareaccess.com', aud: 'test-audience',
      exp: Math.floor(Date.now()/1000)+3600 })).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
    await expect(verifyAccessJwt(req(`${h}.${evilPayload}.${s}`), env)).rejects.toBeInstanceOf(AuthError);
  });

  it('fails closed when POLICY_AUD is empty', async () => {
    const t = await new SignJWT({ email: 'user@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuer('https://test.cloudflareaccess.com')
      .setAudience('test-audience').setExpirationTime('1h').sign(goodKey);
    await expect(verifyAccessJwt(req(t), { ...env, POLICY_AUD: '' }))
      .rejects.toBeInstanceOf(AuthError);
  });
});
