/**
 * Staff @bmxc.camp addresses and the subscriber list.
 *
 * Two features in one file because they share a tab, and nothing else.
 * Addresses proxy Cloudflare; subscribers are ours.
 *
 * The admin half sits behind `campinfo` — handing someone a camp address
 * is camp administration, which that permission already covers. A new
 * grantable area would have to be added to the server, the panel and the
 * database together, and nothing here needs a boundary the existing one
 * does not already draw.
 */
import { Hono } from 'hono';
import { requireArea } from '../auth/middleware.js';
import {
  listRules, createRule, deleteRule, listDestinations, createDestination, RoutingError,
} from '../email/routing-client.js';
import { listSubscribers, toCsv } from '../email/subscribers.js';

const email = new Hono();

email.use('*', requireArea('campinfo'));

async function audit(db, actorEmail, action, detail) {
  await db.prepare(
    'INSERT INTO audit_log (actor_email, action, detail) VALUES (?, ?, ?)',
  ).bind(actorEmail, action, detail).run();
}

/**
 * Turns a RoutingError into a response and rethrows anything else. An
 * unexpected error must reach the platform's handler rather than be
 * flattened into a 400 that hides a bug.
 */
function routingFailure(c, error) {
  if (error instanceof RoutingError) {
    return c.json({ error: error.message }, error.status);
  }
  throw error;
}

email.get('/addresses', async (c) => {
  try {
    return c.json({ addresses: await listRules(c.env) });
  } catch (error) {
    return routingFailure(c, error);
  }
});

email.post('/addresses', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  try {
    const rule = await createRule(c.env, {
      address: body.address,
      destination: body.destination,
    });
    await audit(c.env.DB, c.get('email'), 'email.address.create', rule.address);
    return c.json({ address: rule }, 201);
  } catch (error) {
    return routingFailure(c, error);
  }
});

email.delete('/addresses/:id', async (c) => {
  try {
    await deleteRule(c.env, c.req.param('id'));
    await audit(c.env.DB, c.get('email'), 'email.address.delete', c.req.param('id'));
    return c.json({ ok: true });
  } catch (error) {
    return routingFailure(c, error);
  }
});

email.get('/destinations', async (c) => {
  try {
    return c.json({ destinations: await listDestinations(c.env) });
  } catch (error) {
    return routingFailure(c, error);
  }
});

email.post('/destinations', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  try {
    const created = await createDestination(c.env, body.email);
    await audit(c.env.DB, c.get('email'), 'email.destination.create', created.email);
    return c.json({ destination: created }, 201);
  } catch (error) {
    return routingFailure(c, error);
  }
});

// Only these three statuses exist. An unrecognised one binds nothing and
// would return every row under SQLite's three-valued logic reading as an
// empty result — better to name the allowed set than to guess.
const STATUSES = ['confirmed', 'pending', 'unsubscribed'];

email.get('/subscribers', async (c) => {
  const requested = c.req.query('status') ?? 'confirmed';
  const status = STATUSES.includes(requested) ? requested : 'confirmed';
  return c.json({ subscribers: await listSubscribers(c.env.DB, { status }) });
});

email.get('/subscribers.csv', async (c) => {
  const rows = await listSubscribers(c.env.DB, { status: 'confirmed' });
  return new Response(toCsv(rows), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename="subscribers.csv"',
    },
  });
});

export default email;
