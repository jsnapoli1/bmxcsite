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
import { wantsHtml, resultPage } from '../email/pages.js';

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

/**
 * Answers HTML to a browser and JSON to anything else.
 *
 * The HTML branch is not decoration. With
 * `not_found_handling: "single-page-application"`, the static-asset layer
 * answers a navigation it does not recognise with index.html, and React
 * Router renders "Page not found" — so a JSON-only route is a 404 to
 * every person who clicks the link in their email, while curl reports 200
 * and looks healthy. That is how this shipped broken once.
 */
function answer(c, { title, message }) {
  if (wantsHtml(c.req.raw)) {
    return c.html(resultPage({ title, body: message }));
  }
  return c.json({ ok: true, message });
}

routes.get('/subscribe/confirm', async (c) => {
  await confirm(c.env.DB, c.req.query('token') ?? '');
  // Same answer whether or not the token was real — an unknown token must
  // not reveal whether that address is on the list, and someone clicking
  // an older email should not get an alarming page.
  return answer(c, {
    title: 'You are on the list',
    message: 'Thanks for confirming. We will send camp news now and then, '
      + 'and every email has a link to stop.',
  });
});

routes.get('/unsubscribe', async (c) => {
  await unsubscribe(c.env.DB, c.req.query('token') ?? '');
  return answer(c, {
    title: 'You are unsubscribed',
    message: 'You will not get any more email from us. If that was a '
      + 'mistake, you can sign up again any time.',
  });
});

export default routes;
