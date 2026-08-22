# Phase 1: Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the assets-only Worker into a real Worker with a `fetch` handler, a D1 database, Cloudflare Access authentication, and an admin shell where a signed-in user's permissions can be viewed and edited.

**Architecture:** A single Worker serves the existing static site unchanged at `/`, adds a JSON API at `/api/*`, and serves the admin SPA at `/admin`. Cloudflare Access guards admin routes and supplies a signed JWT; the Worker verifies that JWT with `jose` and looks the email up in a D1 `users` table to resolve per-area permissions. The public site's behaviour and appearance do not change in this phase.

**Tech Stack:** Cloudflare Workers, D1 (SQLite), Hono 4.13 (routing), jose 6.2 (JWT verification), Vitest 4.1 + `@cloudflare/vitest-plugin` 1.0 (tests against real Workers runtime), React 19 + Vite 7 (existing frontend).

**Spec:** `docs/superpowers/specs/2026-08-22-admin-panel-design.md`

## Global Constraints

- **Node version:** 20 (matches `.github/workflows` CI).
- **Module format:** ES modules only (`"type": "module"` in package.json).
- **No secrets in source.** `POLICY_AUD` and `TEAM_DOMAIN` are Worker vars; nothing sensitive is committed.
- **The public site must not change.** Every existing route renders identically at the end of this phase.
- **Permission flags are exactly:** `can_blog`, `can_media`, `can_merch`, `can_campinfo`, `is_admin`. These exact snake_case names are used in the database, the API JSON, and the UI. Do not rename or add.
- **Deny-by-default.** An email with no row in `users` has zero permissions. Never auto-create a user row from a valid JWT.
- **Design direction (from CLAUDE.md):** Field Guide — serif display, warm paper surfaces, **no shadows**, radii 2-6px, structure from rules and weight. Banned: uppercase headings, gradient text, decorative gradients, hover lifts, pill buttons. The admin panel follows this too.
- **Timestamps:** store as INTEGER Unix seconds (`unixepoch()`), never TEXT.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `worker/index.js` | Worker entry: exports `fetch`. Delegates to the Hono app. |
| `worker/app.js` | Hono app: wires middleware and mounts routes. |
| `worker/auth/jwt.js` | Verifies the Access JWT, returns the email claim. Nothing else. |
| `worker/auth/permissions.js` | Loads a user row by email, resolves permission flags. |
| `worker/auth/middleware.js` | Hono middleware: rejects unauthenticated/unauthorised requests. |
| `worker/routes/me.js` | `GET /api/admin/me` — who am I, what may I do. |
| `worker/routes/users.js` | `GET/POST/PATCH/DELETE /api/admin/users` — user management. |
| `migrations/0001_users.sql` | `users` table + `audit_log` table. |
| `src/admin/AdminApp.jsx` | Admin SPA root and routing. |
| `src/admin/pages/Users.jsx` | User list, invite form, permission toggles. |
| `src/admin/lib/api.js` | Typed fetch wrappers for the admin API. |
| `src/admin/admin.css` | Admin styling, Field Guide direction. |
| `vitest.config.js` | Vitest + Workers pool configuration. |
| `test/setup.js` | Applies D1 migrations before each test. |

**Modified:**

| File | Change |
|---|---|
| `wrangler.jsonc` | Add `main`, `d1_databases`, `vars`; keep `assets` and `routes`. |
| `package.json` | Add deps and test/migrate scripts. |
| `vite.config.js` | Add the `admin` build input; drop the dead `gh-pages` base. |
| `index.html` | No change (admin gets its own HTML entry). |
| `.github/workflows/` | Delete the GitHub Pages workflow; add migrations to deploy. |

---

## Task 1: Worker entry point serving the existing site

**Files:**
- Create: `worker/index.js`, `worker/app.js`
- Create: `vitest.config.js`, `test/setup.js`
- Create: `test/worker/app.test.js`
- Modify: `wrangler.jsonc`, `package.json`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `worker/app.js` default-exports a Hono app instance. `worker/index.js` default-exports `{ fetch }`. Env binding names: `ASSETS` (fetcher), `DB` (D1), `POLICY_AUD` (string), `TEAM_DOMAIN` (string).

- [ ] **Step 1: Install dependencies**

```bash
npm install hono@4.13.3 jose@6.2.10
npm install -D vitest@4.1.11 @cloudflare/vitest-plugin@1.0.0
```

- [ ] **Step 2: Write the failing test**

Create `test/worker/app.test.js`:

```js
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run test/worker/app.test.js`
Expected: FAIL — cannot resolve `../../worker/app.js`.

- [ ] **Step 4: Write `vitest.config.js`**

```js
import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin/config';

export default defineConfig({
  plugins: [
    cloudflareTest(async () => {
      const migrations = await readD1Migrations(
        path.join(import.meta.dirname, 'migrations'),
      );
      return {
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            POLICY_AUD: 'test-audience',
            TEAM_DOMAIN: 'https://test.cloudflareaccess.com',
          },
        },
      };
    }),
  ],
  test: {
    setupFiles: ['./test/setup.js'],
  },
});
```

- [ ] **Step 5: Write `test/setup.js`**

```js
import { beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { applyD1Migrations } from 'cloudflare:test';

// Each test file gets isolated storage; re-apply migrations before every test
// so no test can observe rows written by another.
beforeEach(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
```

- [ ] **Step 6: Write `worker/app.js`**

```js
import { Hono } from 'hono';

const app = new Hono();

// Unknown API routes must answer JSON, not the SPA shell — otherwise a
// typo'd fetch resolves to HTML and fails somewhere far less obvious.
app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// Everything else is the existing static site, served by the assets binding.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

- [ ] **Step 7: Write `worker/index.js`**

```js
import app from './app.js';

export default {
  fetch: app.fetch,
};
```

- [ ] **Step 8: Update `wrangler.jsonc`**

Add `main`, the D1 binding, and vars. Keep `assets` and `routes` exactly as they are, but add a binding name so the Worker can call the asset server:

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "bmxcsite",
  "main": "./worker/index.js",
  "compatibility_date": "2026-08-18",
  "account_id": "9569781c361a80bd0b96dedbac0aca6d",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application",
    "binding": "ASSETS"
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "bmxc",
      "database_id": "PLACEHOLDER_SET_IN_STEP_9",
      "migrations_dir": "migrations"
    }
  ],
  "vars": {
    "TEAM_DOMAIN": "https://bmxc.cloudflareaccess.com",
    "POLICY_AUD": ""
  },
  "routes": [
    { "pattern": "bmxc.camp", "custom_domain": true },
    { "pattern": "www.bmxc.camp", "custom_domain": true }
  ]
}
```

- [ ] **Step 9: Create the D1 database and paste its real ID**

```bash
npx wrangler d1 create bmxc
```

Copy the `database_id` from the output into `wrangler.jsonc`, replacing
`PLACEHOLDER_SET_IN_STEP_9`. This is a real value, not a secret — it is
committed.

- [ ] **Step 10: Add scripts to `package.json`**

Add to the `scripts` block:

```json
"test": "vitest run",
"test:watch": "vitest",
"migrate:local": "wrangler d1 migrations apply bmxc --local",
"migrate:remote": "wrangler d1 migrations apply bmxc --remote"
```

Replace the existing `"test": "echo \"No tests specified\" && exit 0"` line.

- [ ] **Step 11: Create an empty migrations dir so the test config resolves**

```bash
mkdir -p migrations && touch migrations/.gitkeep
```

- [ ] **Step 12: Run the test to verify it passes**

Run: `npx vitest run test/worker/app.test.js`
Expected: PASS, 2 tests.

- [ ] **Step 13: Verify the real site still builds and serves**

```bash
npm run build && npx wrangler dev --port 8787
```

Open `http://127.0.0.1:8787/` in a browser. The home page must render exactly
as before, with navigation working. CLAUDE.md is explicit that bugs here are
invisible to a passing build — actually look at it. Then Ctrl-C.

- [ ] **Step 14: Commit**

```bash
git add worker/ test/ vitest.config.js wrangler.jsonc package.json package-lock.json migrations/
git commit -m "feat: add Worker fetch handler in front of static assets"
```

---

## Task 2: Users and audit_log schema

**Files:**
- Create: `migrations/0001_users.sql`
- Create: `test/worker/schema.test.js`

**Interfaces:**
- Consumes: `env.DB` from Task 1.
- Produces: `users` table with columns `email` (TEXT PK), `name` (TEXT), `can_blog`, `can_media`, `can_merch`, `can_campinfo`, `is_admin` (all INTEGER 0/1), `created_at`, `updated_at` (INTEGER). `audit_log` table with `id`, `actor_email`, `action`, `detail`, `created_at`.

- [ ] **Step 1: Write the failing test**

Create `test/worker/schema.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';

describe('schema', () => {
  it('stores a user with permission flags', async () => {
    await env.DB.prepare(
      `INSERT INTO users (email, name, can_blog, is_admin)
       VALUES (?, ?, 1, 1)`,
    ).bind('ken@example.com', 'Ken').run();

    const row = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?',
    ).bind('ken@example.com').first();

    expect(row.name).toBe('Ken');
    expect(row.can_blog).toBe(1);
    expect(row.can_media).toBe(0);
    expect(row.is_admin).toBe(1);
    expect(typeof row.created_at).toBe('number');
  });

  it('rejects a duplicate email', async () => {
    await env.DB.prepare('INSERT INTO users (email) VALUES (?)')
      .bind('dup@example.com').run();

    await expect(
      env.DB.prepare('INSERT INTO users (email) VALUES (?)')
        .bind('dup@example.com').run(),
    ).rejects.toThrow();
  });

  it('records an audit entry', async () => {
    await env.DB.prepare(
      `INSERT INTO audit_log (actor_email, action, detail)
       VALUES (?, ?, ?)`,
    ).bind('ken@example.com', 'user.create', 'sarah@example.com').run();

    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE actor_email = ?',
    ).bind('ken@example.com').first();

    expect(row.action).toBe('user.create');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/worker/schema.test.js`
Expected: FAIL — `no such table: users`.

- [ ] **Step 3: Write the migration**

Create `migrations/0001_users.sql`:

```sql
-- Admin users. Identity comes from Cloudflare Access; this table decides
-- what a verified identity is allowed to do. An email with no row here has
-- no permissions at all.
CREATE TABLE users (
  email        TEXT PRIMARY KEY,
  name         TEXT,
  can_blog     INTEGER NOT NULL DEFAULT 0,
  can_media    INTEGER NOT NULL DEFAULT 0,
  can_merch    INTEGER NOT NULL DEFAULT 0,
  can_campinfo INTEGER NOT NULL DEFAULT 0,
  is_admin     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Who changed what. Permission and publish actions are worth being able to
-- reconstruct after the fact.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_email TEXT NOT NULL,
  action      TEXT NOT NULL,
  detail      TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX idx_audit_log_created_at ON audit_log (created_at DESC);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/worker/schema.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 5: Apply the migration locally**

```bash
npm run migrate:local
```

- [ ] **Step 6: Commit**

```bash
git add migrations/0001_users.sql test/worker/schema.test.js
git commit -m "feat: add users and audit_log schema"
```

---

## Task 3: Access JWT verification

**Files:**
- Create: `worker/auth/jwt.js`
- Create: `test/worker/jwt.test.js`

**Interfaces:**
- Consumes: `env.TEAM_DOMAIN`, `env.POLICY_AUD`.
- Produces: `verifyAccessJwt(request, env)` → `Promise<string>` resolving the verified lowercase email, or throwing `AuthError`. Also exports `class AuthError extends Error` with a `status` property (403).

- [ ] **Step 1: Write the failing test**

Create `test/worker/jwt.test.js`. These tests use a locally generated key pair
so no network call is made:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/worker/jwt.test.js`
Expected: FAIL — cannot resolve `worker/auth/jwt.js`.

- [ ] **Step 3: Write `worker/auth/jwt.js`**

```js
import { jwtVerify, createRemoteJWKSet } from 'jose';

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.status = 403;
  }
}

// One JWKS cache per team domain. createRemoteJWKSet caches and refreshes
// the keys internally, so building a new one per request would defeat that.
const jwksCache = new Map();

function jwksFor(teamDomain) {
  let jwks = jwksCache.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksCache.set(teamDomain, jwks);
  }
  return jwks;
}

/**
 * Verify the Cloudflare Access JWT on a request and return the verified email.
 *
 * Throws AuthError for every failure mode. Callers must not distinguish
 * between them in responses — a caller learning *why* verification failed
 * learns something about our configuration.
 */
export async function verifyAccessJwt(request, env) {
  if (!env.POLICY_AUD || !env.TEAM_DOMAIN) {
    throw new AuthError('Access is not configured');
  }

  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) {
    throw new AuthError('Missing Access token');
  }

  let payload;
  try {
    ({ payload } = await jwtVerify(token, jwksFor(env.TEAM_DOMAIN), {
      issuer: env.TEAM_DOMAIN,
      audience: env.POLICY_AUD,
    }));
  } catch (cause) {
    throw new AuthError('Invalid Access token');
  }

  if (!payload.email) {
    throw new AuthError('Access token has no email claim');
  }

  // Emails are matched against the users table, so casing must not decide
  // whether someone is an admin.
  return String(payload.email).toLowerCase();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/worker/jwt.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/auth/jwt.js test/worker/jwt.test.js
git commit -m "feat: verify Cloudflare Access JWT"
```

---

## Task 4: Permission resolution

**Files:**
- Create: `worker/auth/permissions.js`
- Create: `test/worker/permissions.test.js`

**Interfaces:**
- Consumes: `env.DB` (Task 2 schema).
- Produces:
  - `AREAS` — frozen array `['blog', 'media', 'merch', 'campinfo']`.
  - `loadUser(db, email)` → `Promise<User|null>` where `User` is
    `{ email, name, permissions: { blog, media, merch, campinfo }, isAdmin }`
    with boolean values.
  - `hasPermission(user, area)` → `boolean`. Admins pass every area check.

- [ ] **Step 1: Write the failing test**

Create `test/worker/permissions.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { env } from 'cloudflare:test';
import { loadUser, hasPermission, AREAS } from '../../worker/auth/permissions.js';

async function insertUser(email, flags = {}) {
  await env.DB.prepare(
    `INSERT INTO users (email, name, can_blog, can_media, can_merch,
       can_campinfo, is_admin)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    email,
    flags.name ?? null,
    flags.can_blog ?? 0,
    flags.can_media ?? 0,
    flags.can_merch ?? 0,
    flags.can_campinfo ?? 0,
    flags.is_admin ?? 0,
  ).run();
}

describe('loadUser', () => {
  it('returns null for an unknown email', async () => {
    expect(await loadUser(env.DB, 'nobody@example.com')).toBeNull();
  });

  it('maps database flags to booleans', async () => {
    await insertUser('editor@example.com', { name: 'Ed', can_blog: 1 });
    const user = await loadUser(env.DB, 'editor@example.com');
    expect(user.email).toBe('editor@example.com');
    expect(user.name).toBe('Ed');
    expect(user.permissions.blog).toBe(true);
    expect(user.permissions.media).toBe(false);
    expect(user.isAdmin).toBe(false);
  });

  it('is case-insensitive on email', async () => {
    await insertUser('mixed@example.com', { can_merch: 1 });
    const user = await loadUser(env.DB, 'Mixed@Example.COM');
    expect(user).not.toBeNull();
    expect(user.permissions.merch).toBe(true);
  });
});

describe('hasPermission', () => {
  it('denies a null user every area', () => {
    for (const area of AREAS) {
      expect(hasPermission(null, area)).toBe(false);
    }
  });

  it('grants only the flagged area', async () => {
    await insertUser('blogger@example.com', { can_blog: 1 });
    const user = await loadUser(env.DB, 'blogger@example.com');
    expect(hasPermission(user, 'blog')).toBe(true);
    expect(hasPermission(user, 'media')).toBe(false);
  });

  it('grants an admin every area', async () => {
    await insertUser('boss@example.com', { is_admin: 1 });
    const user = await loadUser(env.DB, 'boss@example.com');
    for (const area of AREAS) {
      expect(hasPermission(user, area)).toBe(true);
    }
  });

  it('denies an unknown area even for an admin', async () => {
    await insertUser('boss2@example.com', { is_admin: 1 });
    const user = await loadUser(env.DB, 'boss2@example.com');
    expect(hasPermission(user, 'billing')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/worker/permissions.test.js`
Expected: FAIL — cannot resolve `worker/auth/permissions.js`.

- [ ] **Step 3: Write `worker/auth/permissions.js`**

```js
/** The four independently grantable content areas. */
export const AREAS = Object.freeze(['blog', 'media', 'merch', 'campinfo']);

/**
 * Load an admin user by email.
 *
 * Returns null when the email has no row. A verified Access identity with no
 * row is a real, expected state: it means someone reached the panel but has
 * not been granted anything yet. Never insert a row here.
 */
export async function loadUser(db, email) {
  const row = await db
    .prepare('SELECT * FROM users WHERE email = ?')
    .bind(String(email).toLowerCase())
    .first();

  if (!row) return null;

  return {
    email: row.email,
    name: row.name,
    permissions: {
      blog: row.can_blog === 1,
      media: row.can_media === 1,
      merch: row.can_merch === 1,
      campinfo: row.can_campinfo === 1,
    },
    isAdmin: row.is_admin === 1,
  };
}

/** Whether `user` may act on `area`. Admins pass every known area. */
export function hasPermission(user, area) {
  if (!user) return false;
  if (!AREAS.includes(area)) return false;
  if (user.isAdmin) return true;
  return user.permissions[area] === true;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run test/worker/permissions.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add worker/auth/permissions.js test/worker/permissions.test.js
git commit -m "feat: resolve per-area permissions from the users table"
```

---

## Task 5: Auth middleware and the `/api/admin/me` route

**Files:**
- Create: `worker/auth/middleware.js`, `worker/routes/me.js`
- Modify: `worker/app.js`
- Create: `test/worker/me.test.js`

**Interfaces:**
- Consumes: `verifyAccessJwt` (Task 3), `loadUser`/`hasPermission`/`AREAS` (Task 4).
- Produces:
  - `requireAuth` — Hono middleware. Sets `c.set('user', user)` (may be `null`) and `c.set('email', email)`. Responds 403 JSON if the JWT is bad.
  - `requireAdmin` — Hono middleware. Responds 403 JSON unless `user.isAdmin`.
  - `requireArea(area)` — Hono middleware factory. Responds 403 JSON unless `hasPermission(user, area)`.
  - `GET /api/admin/me` → `{ email, name, permissions, isAdmin, registered }`.

- [ ] **Step 1: Write the failing test**

Create `test/worker/me.test.js`:

```js
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';

// The JWT path has its own dedicated tests; here we stub verification so
// these tests exercise authorisation rather than re-testing crypto.
function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

function asAnonymous() {
  vi.spyOn(jwt, 'verifyAccessJwt').mockRejectedValue(
    new jwt.AuthError('Missing Access token'),
  );
}

async function get(path) {
  return app.fetch(new Request(`https://bmxc.camp${path}`), env);
}

describe('GET /api/admin/me', () => {
  it('rejects an unauthenticated request', async () => {
    asAnonymous();
    const res = await get('/api/admin/me');
    expect(res.status).toBe(403);
  });

  it('reports registered:false for a verified but ungranted email', async () => {
    asUser('stranger@example.com');
    const res = await get('/api/admin/me');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.registered).toBe(false);
    expect(body.isAdmin).toBe(false);
    expect(body.permissions.blog).toBe(false);
  });

  it('reports the permissions of a known user', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, name, can_blog) VALUES (?, ?, 1)',
    ).bind('writer@example.com', 'Writer').run();

    asUser('writer@example.com');
    const res = await get('/api/admin/me');
    const body = await res.json();
    expect(body.registered).toBe(true);
    expect(body.name).toBe('Writer');
    expect(body.permissions.blog).toBe(true);
    expect(body.permissions.merch).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/worker/me.test.js`
Expected: FAIL — cannot resolve `worker/auth/middleware.js` (imported by app).

- [ ] **Step 3: Write `worker/auth/middleware.js`**

```js
import { verifyAccessJwt, AuthError } from './jwt.js';
import { loadUser, hasPermission } from './permissions.js';

/**
 * Verify the Access JWT and attach the user to the context.
 *
 * A verified email with no users row is allowed past this middleware with
 * user = null, so /me can tell them they have no access yet. Routes that do
 * anything real must additionally use requireAdmin or requireArea.
 */
export async function requireAuth(c, next) {
  let email;
  try {
    email = await verifyAccessJwt(c.req.raw, c.env);
  } catch (error) {
    if (error instanceof AuthError) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    throw error;
  }

  c.set('email', email);
  c.set('user', await loadUser(c.env.DB, email));
  await next();
}

/** Require the caller to be an admin. */
export async function requireAdmin(c, next) {
  const user = c.get('user');
  if (!user?.isAdmin) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
}

/** Require permission on a specific content area. */
export function requireArea(area) {
  return async function areaGuard(c, next) {
    if (!hasPermission(c.get('user'), area)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await next();
  };
}
```

- [ ] **Step 4: Write `worker/routes/me.js`**

```js
import { Hono } from 'hono';
import { AREAS } from '../auth/permissions.js';

const me = new Hono();

const NO_PERMISSIONS = Object.fromEntries(AREAS.map((area) => [area, false]));

me.get('/', (c) => {
  const user = c.get('user');

  if (!user) {
    // Verified by Access, but not granted anything in this panel yet.
    return c.json({
      email: c.get('email'),
      name: null,
      permissions: NO_PERMISSIONS,
      isAdmin: false,
      registered: false,
    });
  }

  return c.json({
    email: user.email,
    name: user.name,
    permissions: user.permissions,
    isAdmin: user.isAdmin,
    registered: true,
  });
});

export default me;
```

- [ ] **Step 5: Mount the route in `worker/app.js`**

Replace the contents of `worker/app.js` with:

```js
import { Hono } from 'hono';
import { requireAuth } from './auth/middleware.js';
import me from './routes/me.js';

const app = new Hono();

// Every admin API route is authenticated. Mount before the 404 catch-all.
app.use('/api/admin/*', requireAuth);
app.route('/api/admin/me', me);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run test/worker/me.test.js`
Expected: PASS, 3 tests.

- [ ] **Step 7: Add coverage for `requireArea`**

`requireArea` is consumed by Phase 2's content routes, but it is written here
and a hole in it would be a hole in every one of those routes. Test it now,
against a route mounted only in the test.

Append to `test/worker/me.test.js`:

```js
import { Hono } from 'hono';
import { requireAuth, requireArea } from '../../worker/auth/middleware.js';

describe('requireArea', () => {
  // A throwaway app: requireArea guards Phase 2 routes that do not exist yet,
  // and an untested guard is a guard that protects nothing.
  const guarded = new Hono();
  guarded.use('/api/admin/*', requireAuth);
  guarded.get('/api/admin/blog', requireArea('blog'), (c) =>
    c.json({ ok: true }));

  const call = () =>
    guarded.fetch(new Request('https://bmxc.camp/api/admin/blog'), env);

  it('denies a user without the area', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, can_merch) VALUES (?, 1)',
    ).bind('merchonly@example.com').run();
    asUser('merchonly@example.com');
    expect((await call()).status).toBe(403);
  });

  it('denies a verified but unregistered email', async () => {
    asUser('nobody@example.com');
    expect((await call()).status).toBe(403);
  });

  it('allows a user with the area', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, can_blog) VALUES (?, 1)',
    ).bind('blogonly@example.com').run();
    asUser('blogonly@example.com');
    expect((await call()).status).toBe(200);
  });

  it('allows an admin', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, is_admin) VALUES (?, 1)',
    ).bind('admin2@example.com').run();
    asUser('admin2@example.com');
    expect((await call()).status).toBe(200);
  });
});
```

- [ ] **Step 8: Run the test to verify the new cases pass**

Run: `npx vitest run test/worker/me.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 9: Run the whole suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add worker/ test/worker/me.test.js
git commit -m "feat: add auth middleware and /api/admin/me"
```

---

## Task 6: User management API

**Files:**
- Create: `worker/routes/users.js`
- Modify: `worker/app.js`
- Create: `test/worker/users.test.js`

**Interfaces:**
- Consumes: `requireAuth`, `requireAdmin` (Task 5); `AREAS` (Task 4).
- Produces, all admin-only, all under `/api/admin/users`:
  - `GET /` → `{ users: User[] }`
  - `POST /` body `{ email, name?, permissions?, isAdmin? }` → 201 `{ user }`
  - `PATCH /:email` body `{ name?, permissions?, isAdmin? }` → 200 `{ user }`
  - `DELETE /:email` → 200 `{ ok: true }`

- [ ] **Step 1: Write the failing test**

Create `test/worker/users.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../../worker/app.js';
import * as jwt from '../../worker/auth/jwt.js';

function asUser(email) {
  vi.spyOn(jwt, 'verifyAccessJwt').mockResolvedValue(email);
}

async function seedAdmin(email = 'admin@example.com') {
  await env.DB.prepare(
    'INSERT INTO users (email, is_admin) VALUES (?, 1)',
  ).bind(email).run();
  return email;
}

async function call(method, path, body) {
  return app.fetch(
    new Request(`https://bmxc.camp${path}`, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
  );
}

describe('users API authorisation', () => {
  it('denies a non-admin', async () => {
    await env.DB.prepare(
      'INSERT INTO users (email, can_blog) VALUES (?, 1)',
    ).bind('editor@example.com').run();
    asUser('editor@example.com');

    expect((await call('GET', '/api/admin/users')).status).toBe(403);
    expect((await call('POST', '/api/admin/users',
      { email: 'x@example.com' })).status).toBe(403);
  });

  it('denies an unregistered but verified email', async () => {
    asUser('stranger@example.com');
    expect((await call('GET', '/api/admin/users')).status).toBe(403);
  });
});

describe('users API', () => {
  it('lists users', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    const res = await call('GET', '/api/admin/users');
    expect(res.status).toBe(200);
    const { users } = await res.json();
    expect(users).toHaveLength(1);
    expect(users[0].email).toBe(admin);
  });

  it('creates a user with the requested permissions', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    const res = await call('POST', '/api/admin/users', {
      email: 'New@Example.com',
      name: 'New Person',
      permissions: { blog: true, media: false, merch: false, campinfo: false },
    });
    expect(res.status).toBe(201);
    const { user } = await res.json();
    expect(user.email).toBe('new@example.com');
    expect(user.permissions.blog).toBe(true);
    expect(user.isAdmin).toBe(false);
  });

  it('rejects an invalid email', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    const res = await call('POST', '/api/admin/users', { email: 'not-email' });
    expect(res.status).toBe(400);
  });

  it('rejects a duplicate email', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'dupe@example.com' });
    const res = await call('POST', '/api/admin/users',
      { email: 'dupe@example.com' });
    expect(res.status).toBe(409);
  });

  it('updates permissions', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'p@example.com' });
    const res = await call('PATCH', '/api/admin/users/p@example.com', {
      permissions: { blog: false, media: true, merch: false, campinfo: false },
    });
    expect(res.status).toBe(200);
    const { user } = await res.json();
    expect(user.permissions.media).toBe(true);
  });

  it('deletes a user', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'gone@example.com' });
    expect((await call('DELETE', '/api/admin/users/gone@example.com')).status)
      .toBe(200);
    const res = await call('GET', '/api/admin/users');
    const { users } = await res.json();
    expect(users.map((u) => u.email)).not.toContain('gone@example.com');
  });

  it('refuses to let an admin remove their own admin flag', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    const res = await call('PATCH', `/api/admin/users/${admin}`,
      { isAdmin: false });
    expect(res.status).toBe(400);
  });

  it('refuses to let an admin delete themselves', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    const res = await call('DELETE', `/api/admin/users/${admin}`);
    expect(res.status).toBe(400);
  });

  it('writes an audit entry when creating a user', async () => {
    const admin = await seedAdmin();
    asUser(admin);
    await call('POST', '/api/admin/users', { email: 'audited@example.com' });
    const row = await env.DB.prepare(
      'SELECT * FROM audit_log WHERE action = ?',
    ).bind('user.create').first();
    expect(row.actor_email).toBe(admin);
    expect(row.detail).toContain('audited@example.com');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run test/worker/users.test.js`
Expected: FAIL — cannot resolve `worker/routes/users.js`.

- [ ] **Step 3: Write `worker/routes/users.js`**

```js
import { Hono } from 'hono';
import { AREAS, loadUser } from '../auth/permissions.js';
import { requireAdmin } from '../auth/middleware.js';

const users = new Hono();

users.use('*', requireAdmin);

// Deliberately permissive: real addresses vary more than most patterns allow.
// This rejects obvious mistakes, not exotic-but-valid addresses.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normaliseEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Map an API permissions object to the five database columns. */
function toFlags(permissions = {}, isAdmin = false) {
  return {
    can_blog: permissions.blog ? 1 : 0,
    can_media: permissions.media ? 1 : 0,
    can_merch: permissions.merch ? 1 : 0,
    can_campinfo: permissions.campinfo ? 1 : 0,
    is_admin: isAdmin ? 1 : 0,
  };
}

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

users.get('/', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM users ORDER BY email',
  ).all();

  return c.json({
    users: results.map((row) => ({
      email: row.email,
      name: row.name,
      permissions: {
        blog: row.can_blog === 1,
        media: row.can_media === 1,
        merch: row.can_merch === 1,
        campinfo: row.can_campinfo === 1,
      },
      isAdmin: row.is_admin === 1,
      createdAt: row.created_at,
    })),
  });
});

users.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = normaliseEmail(body.email);

  if (!EMAIL_PATTERN.test(email)) {
    return c.json({ error: 'A valid email address is required' }, 400);
  }

  const existing = await c.env.DB
    .prepare('SELECT email FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return c.json({ error: 'That person already has access' }, 409);
  }

  const flags = toFlags(body.permissions, body.isAdmin);
  await c.env.DB.prepare(
    `INSERT INTO users
       (email, name, can_blog, can_media, can_merch, can_campinfo, is_admin)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    email,
    typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null,
    flags.can_blog, flags.can_media, flags.can_merch,
    flags.can_campinfo, flags.is_admin,
  ).run();

  await audit(c.env.DB, c.get('email'), 'user.create', email);

  return c.json({ user: await loadUser(c.env.DB, email) }, 201);
});

users.patch('/:email', async (c) => {
  const target = normaliseEmail(c.req.param('email'));
  const body = await c.req.json().catch(() => ({}));

  const existing = await c.env.DB
    .prepare('SELECT * FROM users WHERE email = ?').bind(target).first();
  if (!existing) {
    return c.json({ error: 'No such user' }, 404);
  }

  // Locking yourself out of user management is unrecoverable from the panel.
  if (target === c.get('email') && body.isAdmin === false) {
    return c.json({ error: 'You cannot remove your own admin access' }, 400);
  }

  const permissions = body.permissions ?? {
    blog: existing.can_blog === 1,
    media: existing.can_media === 1,
    merch: existing.can_merch === 1,
    campinfo: existing.can_campinfo === 1,
  };
  const isAdmin = body.isAdmin ?? existing.is_admin === 1;
  const flags = toFlags(permissions, isAdmin);
  const name = body.name === undefined
    ? existing.name
    : (typeof body.name === 'string' && body.name.trim() ? body.name.trim() : null);

  await c.env.DB.prepare(
    `UPDATE users SET name = ?, can_blog = ?, can_media = ?, can_merch = ?,
       can_campinfo = ?, is_admin = ?, updated_at = unixepoch()
     WHERE email = ?`,
  ).bind(
    name, flags.can_blog, flags.can_media, flags.can_merch,
    flags.can_campinfo, flags.is_admin, target,
  ).run();

  await audit(c.env.DB, c.get('email'), 'user.update', target);

  return c.json({ user: await loadUser(c.env.DB, target) });
});

users.delete('/:email', async (c) => {
  const target = normaliseEmail(c.req.param('email'));

  if (target === c.get('email')) {
    return c.json({ error: 'You cannot remove your own access' }, 400);
  }

  const existing = await c.env.DB
    .prepare('SELECT email FROM users WHERE email = ?').bind(target).first();
  if (!existing) {
    return c.json({ error: 'No such user' }, 404);
  }

  await c.env.DB.prepare('DELETE FROM users WHERE email = ?')
    .bind(target).run();
  await audit(c.env.DB, c.get('email'), 'user.delete', target);

  return c.json({ ok: true });
});

export default users;
```

- [ ] **Step 4: Mount the route in `worker/app.js`**

Add the import and the mount line. `worker/app.js` becomes:

```js
import { Hono } from 'hono';
import { requireAuth } from './auth/middleware.js';
import me from './routes/me.js';
import users from './routes/users.js';

const app = new Hono();

app.use('/api/admin/*', requireAuth);
app.route('/api/admin/me', me);
app.route('/api/admin/users', users);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run test/worker/users.test.js`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add worker/routes/users.js worker/app.js test/worker/users.test.js
git commit -m "feat: add user management API"
```

---

## Task 7: Admin SPA shell

**Files:**
- Create: `admin.html`, `src/admin/main.jsx`, `src/admin/AdminApp.jsx`,
  `src/admin/pages/Users.jsx`, `src/admin/lib/api.js`, `src/admin/admin.css`
- Modify: `vite.config.js`, `worker/app.js`

**Interfaces:**
- Consumes: `/api/admin/me` (Task 5), `/api/admin/users` (Task 6).
- Produces: a built `dist/admin.html` served at `/admin`.
  `src/admin/lib/api.js` exports `getMe()`, `listUsers()`, `createUser(input)`,
  `updateUser(email, input)`, `deleteUser(email)`, each returning parsed JSON
  and throwing `ApiError` (with `.status`) on a non-2xx response.

- [ ] **Step 1: Write `src/admin/lib/api.js`**

```js
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, options = {}) {
  const res = await fetch(`/api/admin${path}`, {
    ...options,
    headers: options.body ? { 'content-type': 'application/json' } : {},
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? 'Something went wrong', res.status);
  }
  return res.json();
}

export const getMe = () => request('/me');
export const listUsers = () => request('/users');

export const createUser = (input) =>
  request('/users', { method: 'POST', body: JSON.stringify(input) });

export const updateUser = (email, input) =>
  request(`/users/${encodeURIComponent(email)}`,
    { method: 'PATCH', body: JSON.stringify(input) });

export const deleteUser = (email) =>
  request(`/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
```

- [ ] **Step 2: Write `admin.html` at the repo root**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>BMXC Admin</title>
  </head>
  <body>
    <div id="admin-root"></div>
    <script type="module" src="/src/admin/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Write `src/admin/main.jsx`**

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './AdminApp.jsx';
import '../styles/tokens.css';
import './admin.css';

ReactDOM.createRoot(document.getElementById('admin-root')).render(
  <React.StrictMode>
    <AdminApp />
  </React.StrictMode>,
);
```

- [ ] **Step 4: Write `src/admin/AdminApp.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { getMe } from './lib/api.js';
import Users from './pages/Users.jsx';

export default function AdminApp() {
  const [me, setMe] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMe().then(setMe).catch(setError);
  }, []);

  if (error) {
    return (
      <main className="admin-shell">
        <h1>Admin</h1>
        <p className="admin-notice">
          We could not confirm your access. Try reloading the page.
        </p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="admin-shell">
        <p className="admin-notice" aria-busy="true">Loading…</p>
      </main>
    );
  }

  if (!me.registered) {
    return (
      <main className="admin-shell">
        <h1>Admin</h1>
        <p className="admin-notice">
          You are signed in as <strong>{me.email}</strong>, but you have not
          been given access to anything yet. Ask a camp director to add you.
        </p>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <h1>Admin</h1>
        <p className="admin-identity">
          Signed in as {me.name ?? me.email}
          {me.isAdmin ? ' · Administrator' : ''}
        </p>
      </header>

      {me.isAdmin
        ? <Users currentEmail={me.email} />
        : <p className="admin-notice">
            Content editing arrives in the next phase.
          </p>}
    </main>
  );
}
```

- [ ] **Step 5: Write `src/admin/pages/Users.jsx`**

```jsx
import { useEffect, useState } from 'react';
import { listUsers, createUser, updateUser, deleteUser } from '../lib/api.js';

const AREAS = [
  { key: 'blog', label: 'Blog posts' },
  { key: 'media', label: 'Photos & videos' },
  { key: 'merch', label: 'Merch' },
  { key: 'campinfo', label: 'Camp info' },
];

const EMPTY_PERMISSIONS = {
  blog: false, media: false, merch: false, campinfo: false,
};

export default function Users({ currentEmail }) {
  const [users, setUsers] = useState([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const { users: list } = await listUsers();
    setUsers(list);
  }

  useEffect(() => { refresh().catch(setError); }, []);

  async function handleInvite(event) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await createUser({ email, name, permissions: EMPTY_PERMISSIONS });
      setEmail('');
      setName('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function togglePermission(user, area) {
    setError(null);
    const permissions = { ...user.permissions, [area]: !user.permissions[area] };
    try {
      await updateUser(user.email, { permissions });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRemove(user) {
    setError(null);
    try {
      await deleteUser(user.email);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="admin-section" aria-labelledby="users-heading">
      <h2 id="users-heading">People</h2>
      <p className="admin-help">
        Adding someone here decides what they can edit. They also need to be
        added to Cloudflare Access before they can sign in at all.
      </p>

      {error && <p className="admin-error" role="alert">{error}</p>}

      <form className="admin-invite" onSubmit={handleInvite}>
        <label>
          Email
          <input
            type="email" required value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="person@example.com"
          />
        </label>
        <label>
          Name
          <input
            type="text" value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Optional"
          />
        </label>
        <button type="submit" disabled={busy}>Add person</button>
      </form>

      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Person</th>
            {AREAS.map((area) => (
              <th scope="col" key={area.key}>{area.label}</th>
            ))}
            <th scope="col">Role</th>
            <th scope="col"><span className="visually-hidden">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.email}>
              <th scope="row">
                <span className="admin-person-name">
                  {user.name ?? user.email}
                </span>
                {user.name && (
                  <span className="admin-person-email">{user.email}</span>
                )}
              </th>
              {AREAS.map((area) => (
                <td key={area.key}>
                  <input
                    type="checkbox"
                    checked={user.isAdmin || user.permissions[area.key]}
                    disabled={user.isAdmin}
                    aria-label={`${area.label} for ${user.email}`}
                    onChange={() => togglePermission(user, area.key)}
                  />
                </td>
              ))}
              <td>{user.isAdmin ? 'Administrator' : 'Editor'}</td>
              <td>
                {user.email !== currentEmail && (
                  <button
                    type="button"
                    className="admin-remove"
                    onClick={() => handleRemove(user)}
                  >
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 6: Write `src/admin/admin.css`**

Field Guide direction: paper surface, serif display, rules not shadows.

```css
/* Admin panel. Same Field Guide direction as the public site: ruled rows,
   no shadows, structure from weight and rules. */

.admin-shell {
  max-width: 68rem;
  margin: 0 auto;
  padding: clamp(1.5rem, 1rem + 2vw, 3rem);
  background: var(--color-paper, #f7f4ed);
  color: var(--color-ink, #1c1a17);
  min-height: 100vh;
}

.admin-header {
  border-bottom: 2px solid var(--color-ink, #1c1a17);
  padding-bottom: 0.75rem;
  margin-bottom: 2rem;
}

.admin-shell h1 {
  font-family: var(--font-display, 'Source Serif 4', Georgia, serif);
  font-size: clamp(1.75rem, 1.4rem + 1.4vw, 2.5rem);
  margin: 0;
}

.admin-identity {
  margin: 0.25rem 0 0;
  font-size: 0.9rem;
  color: var(--color-ink-muted, #57534e);
}

.admin-section h2 {
  font-family: var(--font-display, 'Source Serif 4', Georgia, serif);
  font-size: 1.35rem;
  margin: 0 0 0.25rem;
}

.admin-help,
.admin-notice {
  color: var(--color-ink-muted, #57534e);
  font-size: 0.925rem;
  max-width: 60ch;
}

.admin-error {
  border-left: 3px solid var(--color-gold, #c09018);
  padding: 0.5rem 0.75rem;
  background: #fdf8ec;
  font-size: 0.925rem;
}

.admin-invite {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin: 1.5rem 0;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-rule, #d9d2c4);
}

.admin-invite label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  font-weight: 600;
}

.admin-invite input {
  border: 1px solid var(--color-rule, #d9d2c4);
  border-radius: 2px;
  padding: 0.45rem 0.6rem;
  font: inherit;
  font-size: 0.925rem;
  background: #fff;
  min-width: 16rem;
}

.admin-invite input:focus-visible,
.admin-table input:focus-visible {
  outline: 2px solid var(--color-navy, #183060);
  outline-offset: 1px;
}

.admin-invite button {
  border: 1px solid var(--color-navy, #183060);
  border-radius: 2px;
  background: var(--color-navy, #183060);
  color: #fff;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.admin-invite button:disabled { opacity: 0.6; cursor: progress; }

.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.925rem;
}

.admin-table th,
.admin-table td {
  text-align: left;
  padding: 0.6rem 0.5rem;
  border-bottom: 1px solid var(--color-rule, #d9d2c4);
  vertical-align: middle;
}

.admin-table thead th {
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  font-weight: 700;
  border-bottom: 2px solid var(--color-ink, #1c1a17);
}

.admin-table tbody th { font-weight: 600; }

.admin-person-name { display: block; }

.admin-person-email {
  display: block;
  font-weight: 400;
  font-size: 0.8rem;
  color: var(--color-ink-muted, #57534e);
}

.admin-remove {
  border: 1px solid var(--color-rule, #d9d2c4);
  border-radius: 2px;
  background: transparent;
  font: inherit;
  font-size: 0.85rem;
  padding: 0.3rem 0.7rem;
  cursor: pointer;
}

.admin-remove:hover { border-color: var(--color-ink, #1c1a17); }

.visually-hidden {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
```

- [ ] **Step 7: Add the admin entry to `vite.config.js`**

The `gh-pages` base is dead once the Pages workflow is deleted in Task 8, so
it goes now rather than lingering as a misleading comment.

```js
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
});
```

- [ ] **Step 8: Serve `/admin` from the Worker**

The assets binding has `not_found_handling: single-page-application`, which
would answer `/admin` with the *public* `index.html`. Route it explicitly.
`worker/app.js` becomes:

```js
import { Hono } from 'hono';
import { requireAuth } from './auth/middleware.js';
import me from './routes/me.js';
import users from './routes/users.js';

const app = new Hono();

app.use('/api/admin/*', requireAuth);
app.route('/api/admin/me', me);
app.route('/api/admin/users', users);

app.all('/api/*', (c) => c.json({ error: 'Not found' }, 404));

// SPA fallback would otherwise serve the public index.html here.
app.get('/admin', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));
app.get('/admin/*', (c) =>
  c.env.ASSETS.fetch(new Request(new URL('/admin.html', c.req.url), c.req.raw)));

app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
```

- [ ] **Step 9: Build and confirm both entries emit**

```bash
npm run build && ls dist/
```

Expected: both `index.html` and `admin.html` present in `dist/`.

- [ ] **Step 10: Run the whole suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add admin.html src/admin/ vite.config.js worker/app.js
git commit -m "feat: add admin panel shell with user management UI"
```

---

## Task 8: Retire GitHub Pages and deploy migrations in CI

**Files:**
- Delete: the GitHub Pages workflow in `.github/workflows/`
- Modify: the Cloudflare deploy workflow in `.github/workflows/`

**Interfaces:**
- Consumes: `npm run migrate:remote` (Task 1).
- Produces: a single deploy path — push to `main` runs migrations, then deploys.

- [ ] **Step 1: Identify the two workflow files**

```bash
ls .github/workflows/
grep -l "Pages" .github/workflows/*.yml
```

- [ ] **Step 2: Delete the Pages workflow**

```bash
git rm .github/workflows/<pages-workflow-file>.yml
```

Use the filename found in Step 1. Cloudflare Workers is the only deploy target
per README and CLAUDE.md; a Pages build would serve a copy with no database,
no API, and a broken admin panel.

- [ ] **Step 3: Add the migration step to the Cloudflare workflow**

In the Cloudflare deploy workflow, insert a step between `npm run build` and
the `wrangler-action` step:

```yaml
      - name: Apply D1 migrations
        uses: cloudflare/wrangler-action@v4
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: d1 migrations apply bmxc --remote
```

Migrations run before the deploy so the new code never meets an old schema.

- [ ] **Step 4: Verify the workflow file parses**

```bash
node -e "const fs=require('fs');const f=require('path');for(const n of fs.readdirSync('.github/workflows')){console.log(n, fs.readFileSync(f.join('.github/workflows',n),'utf8').includes('d1 migrations')?'(has migrations)':'')}"
```

Expected: one workflow file remains, and it mentions `d1 migrations`.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/
git commit -m "ci: retire GitHub Pages, run D1 migrations before deploy"
```

---

## Task 9: Manual verification and Access setup

**Files:** none — this task is configuration and browser verification.

**Interfaces:**
- Consumes: everything above.
- Produces: a working, protected `/admin` in production with one admin user.

- [ ] **Step 1: Apply migrations to the remote database**

```bash
npm run migrate:remote
```

- [ ] **Step 2: Create the first admin user**

There is no bootstrap endpoint by design — an unauthenticated "make me admin"
route is exactly the hole this system exists to close. Seed the first admin
directly:

```bash
npx wrangler d1 execute bmxc --remote \
  --command "INSERT INTO users (email, name, is_admin) VALUES ('jsnapoli1@gmail.com', 'Jack', 1)"
```

- [ ] **Step 3: Create the Access application**

In the Cloudflare dashboard: **Zero Trust → Access → Applications → Add an
application → Self-hosted**.

- Application name: `BMXC Admin`
- Session duration: 24 hours
- Public hostname: `bmxc.camp`, path `admin`
- Add a second hostname entry for path `api/admin`
- Policy: name `Camp staff`, action *Allow*, include *Emails* →
  `jsnapoli1@gmail.com`

Copy the **Application Audience (AUD) Tag** from the application's overview.

- [ ] **Step 4: Set `POLICY_AUD` and `TEAM_DOMAIN`**

Put the real AUD tag and team domain into `wrangler.jsonc` `vars`, replacing
the empty `POLICY_AUD` and the placeholder `TEAM_DOMAIN`. The AUD tag is an
identifier, not a secret, and it is committed so CI deploys keep it.

Find the team domain under **Zero Trust → Settings → Custom Pages**, or in the
Zero Trust URL: `https://<team-name>.cloudflareaccess.com`.

- [ ] **Step 5: Deploy**

```bash
npm run build && npx wrangler deploy
```

- [ ] **Step 6: Verify in a browser — the public site is unchanged**

Visit `https://bmxc.camp/`. Click through every route: home, camp, playlists,
videos, merch, staff, faq, registration, contact. CLAUDE.md warns that this
project's bugs are invisible to a passing build. Confirm reveal animations
still run and nothing is stuck at `opacity: 0`.

- [ ] **Step 7: Verify in a browser — admin is protected**

Open `https://bmxc.camp/admin` in a private window. Expected: the Cloudflare
Access login screen, *not* the panel. Sign in with the allowed email. Expected:
the panel loads and shows "Signed in as Jack · Administrator".

- [ ] **Step 8: Verify the API rejects unauthenticated calls**

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://bmxc.camp/api/admin/users
```

Expected: `302` (Access redirect) or `403`. Anything in the 2xx range is a
failure — stop and fix before continuing.

- [ ] **Step 9: Exercise user management in the browser**

In the panel: add a person, toggle each of their four permissions, then remove
them. Confirm the Remove button does not appear on your own row, and that
your own admin checkbox cannot be unticked.

- [ ] **Step 10: Confirm the audit log recorded the actions**

```bash
npx wrangler d1 execute bmxc --remote \
  --command "SELECT actor_email, action, detail FROM audit_log ORDER BY id DESC LIMIT 10"
```

Expected: `user.create`, `user.update`, and `user.delete` rows attributed to
your email.

- [ ] **Step 11: Commit any configuration changes**

```bash
git add wrangler.jsonc
git commit -m "chore: point the Worker at the live Access application"
```

---

## Definition of done

- [ ] `npm test` passes with no skipped tests
- [ ] `npm run build` emits both `index.html` and `admin.html`
- [ ] Every public route renders identically to before, verified in a browser
- [ ] `/admin` is unreachable without signing in through Access
- [ ] `/api/admin/*` returns 403 to an unauthenticated caller
- [ ] A verified email with no `users` row sees "no access yet", not the panel
- [ ] An admin can add a person, set their permissions, and remove them
- [ ] An admin cannot remove their own admin flag or delete themselves
- [ ] Permission changes appear in `audit_log`
- [ ] Only one deploy workflow remains, and it applies migrations first
