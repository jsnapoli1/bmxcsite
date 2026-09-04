/**
 * Stripe Checkout, and the webhook that is the only writer of paid state.
 *
 * No Stripe SDK: it is a large dependency for two HTTP calls and an
 * HMAC, and the Workers runtime has WebCrypto natively. Card details
 * never reach this worker — Checkout is hosted by Stripe, which is what
 * keeps PCI scope at SAQ-A.
 */

const API = 'https://api.stripe.com/v1';

/** Reject a signature older than this. Stripe's own default tolerance. */
const TOLERANCE_SECONDS = 300;

export class StripeError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   */
  constructor(message, status) {
    super(message);
    this.name = 'StripeError';
    this.status = status;
  }
}

/** HMAC-SHA256, hex encoded — the scheme Stripe signs webhooks with. */
export async function signPayload(payload, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Constant-time comparison, so a wrong signature cannot be discovered a
 * character at a time by measuring how long the check took.
 */
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies the `stripe-signature` header against the raw body.
 *
 * The raw body, not a re-serialised object: JSON.stringify does not
 * guarantee byte-identical output, and a signature is over bytes.
 */
export async function verifyWebhook(signatureHeader, rawBody, secret) {
  if (!signatureHeader) throw new StripeError('Missing signature.', 400);
  if (!secret) throw new StripeError('Webhook secret is not configured.', 500);

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('=', 2)),
  );

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) throw new StripeError('Malformed signature.', 400);

  // An old signature is a replay. Stripe signs the timestamp alongside
  // the body for exactly this reason.
  const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (age > TOLERANCE_SECONDS) throw new StripeError('Signature too old.', 400);

  const expected = await signPayload(`${timestamp}.${rawBody}`, secret);
  if (!parts.v1 || !timingSafeEqual(expected, parts.v1)) {
    throw new StripeError('Signature does not match.', 400);
  }

  return JSON.parse(rawBody);
}

/**
 * Creates a hosted Checkout session for the deposit.
 *
 * The amount comes from the server's own quote. `metadata.reference` is
 * how the webhook finds the registration again — the client never gets
 * to say which registration a payment belongs to.
 */
export async function createCheckoutSession(env, { registration, quote, origin }) {
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${origin}/register?paid=${registration.reference}`,
    cancel_url: `${origin}/register?ref=${registration.reference}`,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(quote.depositCents),
    'line_items[0][price_data][product_data][name]': 'Blue Mountain XC Camp deposit',
    'metadata[reference]': registration.reference,
  });

  if (registration.guardian_email) form.set('customer_email', registration.guardian_email);

  const res = await fetch(`${API}/checkout/sessions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    // Never echo Stripe's raw error to a browser — it can name internal
    // configuration. Log it; tell the caller something plain.
    console.error(`Stripe checkout failed: ${JSON.stringify(payload?.error ?? {})}`);
    throw new StripeError('Could not start the payment.', 502);
  }

  return { id: payload.id, url: payload.url };
}
