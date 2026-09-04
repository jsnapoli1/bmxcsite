# Camp registration

A registration flow the camp owns: camper and guardian details, bus
selection, tiered pricing, and a deposit taken through Stripe Checkout.

**Health data is deliberately out of scope.** See below — this is the
decision the rest of the design is shaped around.

## What exists already

`src/data/registration.js` holds the camp's real rules, taken from
bluemountainxccamp.com: a $655 base price, three date-windowed tiers
(Early Bird −$100, Full Rate −$55, Late Rate), bus routes at $100 (NJ)
and $125 (NY), a $250 non-refundable deposit, sibling discount of $50
from the second child, and the refund policy.

`/registration` renders those today and its call to action points at
`bluemountainxccamp.com/registration.html`, which hands off to
**CampNetwork** (`portal.campnetwork.com/Register/Register.php?camp_id=398522`).
That portal stays live and is the fallback until this ships.

`campers` (migration 0009) already holds bib, name, and the face-tagging
`consent_at`. Registration writes into it, so consent is captured from a
guardian at signup rather than typed in later by a director.

## Health data, and why it is not here

Camp registration normally collects allergies, medications, conditions
and insurance. That is protected health information for a minor.

**Cloudflare signs a HIPAA BAA only with Enterprise customers**, and it
must be executed before any PHI passes through their network. D1 and
Workers are on the covered-services list, so the technology is not the
obstacle — the contract is. bmxc.camp is on the Free plan, so there is no
BAA and nothing to enable that creates one.

Encrypting health data in D1 today would look compliant without being
compliant, which is worse than not storing it: it carries the confidence
without the coverage.

So health intake happens elsewhere — a service that will sign a BAA, or
on paper at check-in. The schema leaves room for it: a `registrations`
row is the anchor a future `health` record would attach to, and adding
that is additive if an Enterprise agreement is ever signed.

Everything else on a registration form — names, ages, addresses,
emergency contacts, payment — is ordinary personal data and is handled
here.

## The flow

Four steps, each saved as it completes, so a guardian can close the tab
and come back.

1. **Camper** — name, date of birth, school, grade, years attended.
2. **Guardian** — name, email, phone, address, plus a second emergency
   contact. The email is the handle for the whole registration.
3. **Options** — bus route or own transport, t-shirt size, and the
   face-tagging consent question, asked in plain words with the default
   *off*.
4. **Pay** — a price breakdown, then Stripe Checkout.

A registration is `draft` until payment, `confirmed` after, and
`cancelled` if withdrawn. Nothing but a Stripe webhook may set
`confirmed`.

## Pricing

Computed **server-side, always**. The client shows a breakdown; the
server recomputes it when creating the Checkout session and ignores
anything the client sent about price. A tampered form must not be able
to buy a camp place for a dollar.

The tier comes from the registration date against the windows in
`registration.js`, which becomes the single source of truth shared by
the public page and the worker. Sibling discount applies from the second
confirmed registration sharing a guardian email.

**Deposit now, balance later.** $250 at Checkout; the balance follows the
camp's existing rule — billed end of May for registrations before then,
due in full at registration from June 1. This phase records what is owed
and when; it does not automate the second charge.

## Payments

**Stripe Checkout**, hosted. Card details never reach this site, which
keeps PCI scope at SAQ-A. No card data is stored, logged, or proxied.

The webhook is the only writer of paid state, and it verifies the Stripe
signature before trusting anything. A `checkout.session.completed` event
moves the registration to `confirmed` and records the payment.

Webhook handlers must be **idempotent** — Stripe retries, and a repeated
event must not create a second payment row or a second camper.

Needs `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Until both are
set, registration accepts drafts and cannot take payment, and the page
says so rather than failing at the last step. This mirrors the merch
store, which is already in exactly that state.

## Admin

A **Registrations** tab under a new `registrations` permission — its own
area, not a reuse of `campinfo`, because this data is guardians' contact
details and children's names rather than site copy.

It lists registrations with status, tier, amount paid and balance due;
allows export to CSV for the camp's own use; and can cancel a
registration. It cannot edit payment state — that belongs to Stripe and
the webhook.

`registrations` goes into `AREAS` on the server **and** into
`permission-areas.js`, which the existing cross-check test enforces.
`worker/routes/users.js` derives its columns from `AREAS`, so no other
edit is needed there.

## Data

```
registrations
  id, reference, status, guardian_email, guardian_name, guardian_phone,
  address_*, emergency_name, emergency_phone,
  camper_name, camper_dob, camper_school, camper_grade,
  bus_route, shirt_size, photo_consent,
  tier, base_cents, bus_cents, sibling_discount_cents, total_cents,
  deposit_paid_cents, balance_due_cents, balance_due_at,
  created_at, confirmed_at, cancelled_at

payments
  id, registration_id, stripe_session_id UNIQUE, stripe_payment_intent,
  amount_cents, status, created_at
```

`reference` is a short human-quotable code for phone calls. The UNIQUE on
`stripe_session_id` is what makes webhook replay idempotent.

Ages: `camper_dob` rather than an age, because an age is wrong within a
year of being written.

## What this does not do

- **No health data.** Above.
- **No automated balance charge.** Recorded, not collected.
- **No account or login for guardians.** A registration is reached by its
  emailed link; there is no password to reset for a once-a-year form.
- **No CampNetwork migration.** Existing registrations stay there. This
  runs alongside until the camp chooses to switch.

## Testing

- Pricing: each tier boundary, both bus routes, the sibling discount on
  the second and third child, and that a client-supplied price is
  ignored.
- Webhook: a valid signature confirms; an invalid one is rejected; a
  replayed event writes nothing twice.
- Status: nothing but the webhook can set `confirmed`.
- Permission: `registrations` present in both AREAS lists; the admin
  routes reject anyone without it.
- Consent: a registration writes `campers.consent_at` only when the
  guardian said yes.
- Browser: the four steps at 375px and 1280px, and a navigation to any
  new public route rendering as HTML rather than the SPA 404 — the
  `run_worker_first` failure this repo has already been bitten by.

## Sequence

1. Schema, pricing module, and its tests. No UI.
2. Public API: create draft, update, read by reference.
3. Stripe Checkout and the webhook.
4. The four-step public form.
5. Admin tab and CSV export.

Phase 1 is worth doing alone: the pricing rules are where a quiet error
costs the camp money, and they are testable with no UI at all.

## Open items

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are unset. The merch
  store is blocked on the same key.
- Where health intake actually happens is undecided, and the camp needs
  an answer before a real season runs through this.
- Whether to keep CampNetwork for a season in parallel is the camp's
  call, not a technical one.
