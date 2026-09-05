/**
 * The public registration API.
 *
 * No authentication: a guardian filling in a form has no account. The
 * reference is the credential — 8 characters from a 30-character
 * alphabet, which is enough that guessing another family's registration
 * is impractical.
 *
 * Every response carries a quote the *server* computed. A price in a
 * request body is a number an attacker chose, and repository.js drops it
 * before it can reach a column.
 */
import { Hono } from 'hono';
import {
  createDraft, updateDraft, getByReference, confirmedSiblingCount,
  RegistrationError,
} from '../registration/repository.js';
import { quote } from '../../src/lib/pricing.js';
import { recordPayment } from '../registration/repository.js';
import { createCheckoutSession, verifyWebhook, StripeError } from '../registration/stripe.js';

const registration = new Hono();

/**
 * "Now", as the pricing module should see it.
 *
 * Registration runs January to June, so for half the year the priced path
 * cannot be exercised at all — including in a browser, which is where
 * this repo's real bugs get found. `REGISTRATION_TODAY` moves the clock
 * for local development.
 *
 * Two locks, and neither is the hostname. `wrangler dev` rewrites the
 * request URL to the configured route host, so a Worker running on
 * localhost sees `bmxc.camp` and a hostname check can never pass locally
 * — it made this override useless for the one job it has.
 *
 * Instead both vars must be set, and `DEV_MODE` is deliberately absent
 * from wrangler.jsonc: it can only come from `.dev.vars`, which is
 * gitignored and never deployed. A production Worker has no way to
 * acquire it short of someone adding it to the config on purpose.
 */
function now(c) {
  const override = c.env.REGISTRATION_TODAY;
  if (!override) return new Date();

  if (c.env.DEV_MODE !== 'true') {
    console.error('REGISTRATION_TODAY ignored: DEV_MODE is not set.');
    return new Date();
  }

  const parsed = new Date(`${override}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    console.error(`REGISTRATION_TODAY is not a date: ${override}`);
    return new Date();
  }

  return parsed;
}

/**
 * The server's own price for a row, never the client's.
 *
 * `null` when registration is closed for the year — the pricing module
 * refuses to invent a tier outside the window, and the responses below
 * pass that through as `quote: null` with `registrationOpen: false` so a
 * form can say so plainly instead of showing a blank price.
 */
async function priceFor(c, row) {
  const siblingIndex = row.guardian_email
    ? await confirmedSiblingCount(c.env.DB, row.guardian_email)
    : 0;

  return quote({
    date: now(c),
    busRoute: row.bus_route,
    siblingIndex,
  });
}

/** One response shape for every route here. */
function withQuote(c, row, priced, status = 200) {
  return c.json({
    registration: row,
    reference: row.reference,
    quote: priced,
    registrationOpen: priced !== null,
  }, status);
}

async function readJson(c) {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

registration.post('/', async (c) => {
  const body = await readJson(c);
  if (body === null) return c.json({ error: 'Request body must be valid JSON' }, 400);

  const row = await createDraft(c.env.DB, body);
  return withQuote(c, row, await priceFor(c, row), 201);
});

registration.patch('/:reference', async (c) => {
  const body = await readJson(c);
  if (body === null) return c.json({ error: 'Request body must be valid JSON' }, 400);

  let row;
  try {
    row = await updateDraft(c.env.DB, c.req.param('reference'), body);
  } catch (error) {
    if (error instanceof RegistrationError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  if (row === null) return c.json({ error: 'No such registration.' }, 404);
  return withQuote(c, row, await priceFor(c, row));
});

registration.get('/:reference', async (c) => {
  const row = await getByReference(c.env.DB, c.req.param('reference'));
  if (row === null) return c.json({ error: 'No such registration.' }, 404);
  return withQuote(c, row, await priceFor(c, row));
});

registration.post('/:reference/checkout', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({
      error: 'Online payment is not set up yet. Please contact the camp directors.',
    }, 503);
  }

  const row = await getByReference(c.env.DB, c.req.param('reference'));
  if (row === null) return c.json({ error: 'No such registration.' }, 404);
  if (row.status !== 'draft') return c.json({ error: 'This registration is already paid.' }, 409);

  const priced = await priceFor(c, row);
  if (priced === null) return c.json({ error: 'Registration is closed for this year.' }, 400);

  try {
    // SITE_ORIGIN when set, otherwise the request's own origin. Needed
    // because `wrangler dev` rewrites the request URL to the configured
    // route host, so locally the origin is https://bmxc.camp and Stripe
    // would send a developer back to production after paying.
    const origin = c.env.SITE_ORIGIN || new URL(c.req.url).origin;

    const session = await createCheckoutSession(c.env, {
      registration: row,
      quote: priced,
      origin,
    });
    return c.json({ url: session.url });
  } catch (error) {
    if (error instanceof StripeError) return c.json({ error: error.message }, error.status);
    throw error;
  }
});

/**
 * The only writer of paid state.
 *
 * Reads the raw body before parsing: the signature is over bytes, and
 * re-serialising a parsed object does not reproduce them.
 */
registration.post('/webhook', async (c) => {
  const rawBody = await c.req.text();

  let event;
  try {
    event = await verifyWebhook(
      c.req.header('stripe-signature'),
      rawBody,
      c.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    if (error instanceof StripeError) return c.json({ error: error.message }, error.status);
    throw error;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    await recordPayment(c.env.DB, {
      reference: session.metadata?.reference,
      sessionId: session.id,
      paymentIntent: session.payment_intent,
      amountCents: session.amount_total,
    });
  }

  // Always acknowledge a well-signed event, including one naming a
  // registration we do not have. Returning an error would make Stripe
  // retry something that can never succeed.
  return c.json({ received: true });
});

export default registration;
