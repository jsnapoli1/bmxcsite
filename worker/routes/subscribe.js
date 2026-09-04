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
import { confirmationEmail } from '../email/confirmation.js';

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

  let token;
  try {
    ({ token } = await subscribe(c.env.DB, body.email));
  } catch (error) {
    // A malformed address is worth saying, and reveals nothing about who
    // is on the list — the caller already knows what they typed.
    if (error instanceof SubscriberError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  // The row is the durable record; the email is a delivery attempt over
  // it. A send that fails must not lose the subscription — the person
  // would be unable to confirm and unable to retry, because re-submitting
  // looks identical from outside. So this never throws past here.
  //
  // The answer is the same either way, which is what stops this endpoint
  // being used to probe who is on the list. A caller learning that the
  // send failed would learn the address was accepted.
  if (c.env.EMAIL) {
    try {
      await c.env.EMAIL.send(confirmationEmail({
        to: String(body.email).trim().toLowerCase(),
        token,
        origin: new URL(c.req.url).origin,
      }));
    } catch (error) {
      // Logged for an operator, invisible to the caller. `error.code` is
      // one of Cloudflare's E_* codes and says whether this is worth
      // retrying (E_RATE_LIMIT_EXCEEDED) or a misconfiguration
      // (E_SENDER_NOT_VERIFIED).
      console.error(`Confirmation send failed: ${error?.code ?? ''} ${error?.message ?? error}`);
    }
  }

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
