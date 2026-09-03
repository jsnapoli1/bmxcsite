/**
 * The public subscribe, confirm and unsubscribe endpoints.
 *
 * No authentication, by design — a parent subscribing has no account, and
 * an unsubscribe link that asked someone to sign in would not be an
 * unsubscribe link.
 *
 * Every response here is deliberately uniform. Saying "you are already
 * subscribed", or "no such token", would turn these into a way to test
 * whether a given address is on the list.
 */
import { Hono } from 'hono';
import { subscribe, confirm, unsubscribe, SubscriberError } from '../email/subscribers.js';

const routes = new Hono();

// One answer for every outcome of POST /subscribe. See the module comment.
const SAME_ANSWER = Object.freeze({
  ok: true,
  message: 'Check your email for a link to confirm.',
});

routes.post('/subscribe', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Request body must be valid JSON' }, 400);
  }

  try {
    await subscribe(c.env.DB, body.email);
  } catch (error) {
    // A malformed address is worth saying, and reveals nothing about who
    // is on the list — the caller already knows what they typed.
    if (error instanceof SubscriberError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  // The confirmation email is not sent yet: Email Sending is not onboarded
  // on bmxc.camp (`wrangler email sending enable bmxc.camp`), so there is
  // nothing to send it with. The row exists and the token is issued, so
  // the flow works end to end the moment that is done.
  return c.json(SAME_ANSWER);
});

routes.get('/subscribe/confirm', async (c) => {
  await confirm(c.env.DB, c.req.query('token') ?? '');
  // Same answer whether or not the token was real.
  return c.json({ ok: true, message: 'You are subscribed. Thanks!' });
});

routes.get('/unsubscribe', async (c) => {
  await unsubscribe(c.env.DB, c.req.query('token') ?? '');
  return c.json({ ok: true, message: 'You will not get any more email from us.' });
});

export default routes;
