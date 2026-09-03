/**
 * Face tagging: the camp roster, and a proxy to the face service.
 *
 * The service (face-service/ in this repo) is Python with a ~280MB model
 * and cannot run on Workers. It is not deployed. Until FACE_ORIGIN is set
 * every proxied route reports 503; the roster half works regardless,
 * because that is ours.
 *
 * Consent is enforced here, on the way in. `/ingest` posts only the
 * consenting roster and refuses outright when that roster is empty — a
 * bib with no consent is never sent, so the service is not merely stopped
 * from enrolling it, it is never told the name exists.
 */
import { Hono } from 'hono';
import { requireArea } from '../auth/middleware.js';
import {
  listCampers, upsertCamper, recordConsent, withdrawConsent,
  consentedRoster, RosterError,
} from '../faces/roster.js';

const faces = new Hono();

faces.use('*', requireArea('faces'));

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

/**
 * Paths this proxy will forward, by method.
 *
 * An allowlist, not a pass-through. The service also exposes /config and,
 * in its demo build, an agent endpoint; neither belongs to this
 * permission. Adding a capability should be a decision, not a side effect
 * of the service growing a route.
 */
const ALLOWED = [
  { method: 'GET', pattern: /^\/identities$/ },
  { method: 'GET', pattern: /^\/photos$/ },
  { method: 'GET', pattern: /^\/observations$/ },
  { method: 'GET', pattern: /^\/search$/ },
  { method: 'POST', pattern: /^\/identities\/\d+\/unenroll$/ },
  { method: 'POST', pattern: /^\/rebuild$/ },
];

function isAllowed(method, path) {
  return ALLOWED.some((rule) => rule.method === method && rule.pattern.test(path));
}

async function serviceFetch(env, path, init = {}) {
  return fetch(`${env.FACE_ORIGIN}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${env.FACE_TOKEN ?? ''}`,
    },
  });
}

/**
 * Guards every route that needs the service to exist. The roster routes
 * deliberately do not use it — a director can build the roster and record
 * consent long before anything is deployed.
 */
async function serviceRequired(c, next) {
  if (!c.env.FACE_ORIGIN) {
    return c.json({
      error: 'Face tagging is not set up yet. No service has been configured.',
    }, 503);
  }
  return next();
}

// --- The roster: ours, and available whether or not the service is up ----

faces.get('/campers', async (c) => c.json({ campers: await listCampers(c.env.DB) }));

faces.post('/campers', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  let camper;
  try {
    camper = await upsertCamper(c.env.DB, {
      bib: body.bib, name: body.name, actorEmail: c.get('email'),
    });
  } catch (error) {
    if (error instanceof RosterError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  await audit(c.env.DB, c.get('email'), 'faces.camper.upsert', camper.bib);
  return c.json({ camper }, 201);
});

faces.post('/campers/:bib/consent', async (c) => {
  const camper = await recordConsent(c.env.DB, c.req.param('bib'), c.get('email'));
  if (camper === null) return c.json({ error: 'No such camper.' }, 404);

  await audit(c.env.DB, c.get('email'), 'faces.consent.record', camper.bib);
  return c.json({ camper });
});

faces.delete('/campers/:bib/consent', async (c) => {
  const camper = await withdrawConsent(c.env.DB, c.req.param('bib'), c.get('email'));
  if (camper === null) return c.json({ error: 'No such camper.' }, 404);

  await audit(c.env.DB, c.get('email'), 'faces.consent.withdraw', camper.bib);
  return c.json({ camper });
});

// --- Everything below needs the service ----------------------------------

faces.use('/ingest', serviceRequired);
faces.use('/identities', serviceRequired);
faces.use('/identities/*', serviceRequired);
faces.use('/photos', serviceRequired);
faces.use('/observations', serviceRequired);
faces.use('/search', serviceRequired);
faces.use('/rebuild', serviceRequired);

/**
 * Ingest, with the consent gate.
 *
 * The consenting roster is pushed first, then ingest runs. An empty
 * consenting roster is refused rather than run: it would enroll nobody,
 * but it would still read every photograph, and a pass over children's
 * faces that can produce no legitimate result is not worth making.
 */
faces.post('/ingest', async (c) => {
  const roster = await consentedRoster(c.env.DB);

  if (Object.keys(roster).length === 0) {
    return c.json({
      error: 'No camper has consented yet, so there is nobody who may be tagged.',
    }, 400);
  }

  const rosterRes = await serviceFetch(c.env, '/roster', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(roster),
  });

  if (!rosterRes.ok) {
    return c.json({ error: 'The face service refused the roster.' }, 502);
  }

  const res = await serviceFetch(c.env, '/ingest', { method: 'POST' });
  await audit(c.env.DB, c.get('email'), 'faces.ingest', String(Object.keys(roster).length));

  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
});

// --- The allowlisted proxy ------------------------------------------------

faces.all('/*', async (c) => {
  const url = new URL(c.req.url);
  const path = url.pathname.replace(/^\/api\/admin\/faces/, '');

  if (!isAllowed(c.req.method, path)) {
    return c.json({ error: 'Not found' }, 404);
  }

  const res = await serviceFetch(c.env, `${path}${url.search}`, { method: c.req.method });

  // Reads are not audited; writes are. Same rule as vedit.
  if (c.req.method !== 'GET') {
    await audit(c.env.DB, c.get('email'), 'faces.proxy', `${c.req.method} ${path}`);
  }

  return new Response(res.body, {
    status: res.status,
    headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
  });
});

export default faces;
