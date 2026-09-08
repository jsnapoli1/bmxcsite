import { useEffect, useState } from 'react';
import { Editable } from 'vedit';
import { BUS_ROUTES, INSURANCE } from '../data/registration.js';
import './register.css';

/**
 * The registration form.
 *
 * Four steps, saved as each one completes, so closing the tab loses
 * nothing. The reference is the only handle on a registration and is kept
 * in sessionStorage so a reload resumes rather than starting over.
 *
 * Every price shown comes from the server's response. Nothing here
 * computes money — the server recomputes it when creating the Checkout
 * session and ignores whatever a form sent, so a number computed in the
 * browser would only ever be a second, disagreeing answer.
 *
 * **Editable, but deliberately not composed.** Every authored string here
 * is wrapped in an `<Editable>`, so the wording can be changed from the
 * editor like anywhere else on the site. What this page does *not* have is
 * a `<VeditSlot>`: the four steps share `step`, `fields` and `quote`, and
 * the order they run in is the flow itself, not a layout. A movable
 * payment step would be a way to break checkout from a design tool.
 *
 * Strings that quote a price are templates rather than sentences —
 * `{deposit}`, `{insurance}` — with the value passed through `vars` and
 * substituted at render. The rewrite is saved; the number stays live. A
 * frozen `$250` would go stale the day the deposit moves, and would then
 * disagree with what Stripe actually charges.
 */

const STORAGE_KEY = 'bmxc:registration-reference';

const STEPS = ['Camper', 'Guardian', 'Options', 'Pay'];

const SHIRT_SIZES = ['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL'];

function money(cents) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

/**
 * 'YYYY-MM-DD' as 'May 31' — the ISO string is what the server computes
 * with, not what a parent reads on a bill.
 *
 * Parsed as UTC (the 'T00:00:00Z') to match how pricing.js built it. Left
 * to the local timezone, a date west of Greenwich renders as the day
 * before, and the balance would appear due on May 30.
 */
function readableDate(iso) {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

/**
 * A field label, editable by name.
 *
 * The id is keyed on the field's `name` — the same string the server stores
 * the answer under — so it is stable across a reordering of the form. Wrapping
 * each `<label>`'s text by hand would be forty near-identical lines; this keeps
 * the form readable while still giving every label its own override.
 *
 * The wrapper is a `<span>` inside the existing `<label>`, so the label still
 * labels its input: making the `<label>` itself the Editable would put the
 * input inside the overridable region, and a rewrite would delete the field.
 *
 * No class: `.register__form label` is already a flex column, and the bare text
 * node this replaces was an anonymous flex item, so a plain span lands in the
 * same box. A class here would be a styling hook nothing uses.
 */
function FieldLabel({ name, children }) {
  return (
    <Editable id={`register.field.${name}`} as="span">
      {children}
    </Editable>
  );
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api/registration${path}`, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error ?? 'Something went wrong.');
  return payload;
}

export default function Register() {
  const [step, setStep] = useState(0);
  const [reference, setReference] = useState(null);
  const [registration, setRegistration] = useState(null);
  const [quote, setQuote] = useState(null);
  const [open, setOpen] = useState(true);
  // Set when Stripe redirects back after a successful payment.
  const [paid, setPaid] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({
    camperName: '', camperDob: '', camperSchool: '', camperGrade: '',
    guardianName: '', guardianEmail: '', guardianPhone: '',
    addressLine1: '', addressCity: '', addressState: '', addressPostal: '',
    emergencyName: '', emergencyPhone: '',
    busRoute: '', shirtSize: '', photoConsent: false, insurance: false,
  });

  // Resume an unfinished registration. A guardian who closed the tab
  // should not have to type it all again.
  useEffect(() => {
    // Stripe sends the guardian back here with ?paid=<reference>. Without
    // this the page would try to resume a draft that is now confirmed,
    // clear the stored reference, and show an empty step 1 — so a parent
    // who just paid would be looking at a blank form.
    const params = new URLSearchParams(window.location.search);
    const justPaid = params.get('paid');
    if (justPaid) {
      setPaid(justPaid);
      sessionStorage.removeItem(STORAGE_KEY);
      // Drop the query so a refresh does not keep re-announcing it.
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    api(`/${saved}`)
      .then((payload) => {
        if (payload.registration.status !== 'draft') {
          sessionStorage.removeItem(STORAGE_KEY);
          return;
        }
        setReference(saved);
        setRegistration(payload.registration);
        setQuote(payload.quote);
        setOpen(payload.registrationOpen);
        setFields((prev) => ({
          ...prev,
          camperName: payload.registration.camper_name ?? '',
          camperDob: payload.registration.camper_dob ?? '',
          camperSchool: payload.registration.camper_school ?? '',
          camperGrade: payload.registration.camper_grade ?? '',
          guardianName: payload.registration.guardian_name ?? '',
          guardianEmail: payload.registration.guardian_email ?? '',
          guardianPhone: payload.registration.guardian_phone ?? '',
          addressLine1: payload.registration.address_line1 ?? '',
          addressCity: payload.registration.address_city ?? '',
          addressState: payload.registration.address_state ?? '',
          addressPostal: payload.registration.address_postal ?? '',
          emergencyName: payload.registration.emergency_name ?? '',
          emergencyPhone: payload.registration.emergency_phone ?? '',
          busRoute: payload.registration.bus_route ?? '',
          shirtSize: payload.registration.shirt_size ?? '',
          photoConsent: payload.registration.photo_consent === 1,
          insurance: payload.registration.insurance === 1,
        }));
      })
      .catch(() => sessionStorage.removeItem(STORAGE_KEY));
  }, []);

  function set(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  /** Saves what has been filled in so far, then moves on. */
  async function saveAndAdvance(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    // Only the fields, never a price or a status — the server drops those
    // anyway, and sending them would imply they mattered.
    const payload = { ...fields, busRoute: fields.busRoute || null };

    try {
      const result = reference
        ? await api(`/${reference}`, { method: 'PATCH', body: payload })
        : await api('', { method: 'POST', body: payload });

      const nextReference = result.reference ?? reference;
      setReference(nextReference);
      sessionStorage.setItem(STORAGE_KEY, nextReference);
      setRegistration(result.registration);
      setQuote(result.quote);
      setOpen(result.registrationOpen);
      setStep((current) => Math.min(current + 1, STEPS.length - 1));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api(`/${reference}/checkout`, { method: 'POST' });
      window.location.assign(url);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (paid) {
    return (
      <main className="register">
        <div className="register__inner">
          <Editable id="register.paid.title" as="h1" className="register__title">
            You are registered
          </Editable>
          <Editable id="register.paid.notice" as="p" className="register__notice">
            {'Your deposit is paid and your camper’s place is held. ' +
              'Stripe has emailed you a receipt.'}
          </Editable>
          {/* No mention of a balance here. It used to say "due at the end of
              May", which is wrong from June 1, when quote() makes the whole
              amount payable at registration and there is no balance left. */}
          {/* The reference is the one thing on this screen worth keeping, so it
              stays outside the editable sentence — a rewrite can move the words
              around it but cannot drop it. */}
          <p className="register__hint">
            <Editable id="register.paid.reference-lead" as="span">
              Your reference is
            </Editable>{' '}
            <strong>{paid}</strong>.{' '}
            <Editable id="register.paid.reference-note" as="span">
              Keep it if you need to ring the camp about this registration.
            </Editable>
          </p>
          <div className="register__actions">
            <a className="register__next" href="/">
              <Editable id="register.paid.home-link" as="span">
                Back to the camp site
              </Editable>
            </a>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="register">
      <div className="register__inner">
        <Editable id="register.title" as="h1" className="register__title">
          Register for camp
        </Editable>

        {/* Keyed on the step's own name rather than its position: renaming a
            step should move its override with it, and reordering the flow must
            not slide "Camper" onto the payment step. */}
        <ol className="register__steps" aria-label="Registration steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={index === step ? 'register__step register__step--current' : 'register__step'}
              aria-current={index === step ? 'step' : undefined}
            >
              <Editable id={`register.step.${label.toLowerCase()}`} as="span">
                {label}
              </Editable>
            </li>
          ))}
        </ol>

        {!open && (
          <Editable id="register.closed-notice" as="p" className="register__notice">
            {'Registration is closed for this year. You can still fill this in ' +
              'and we will hold it, but payment opens when registration does.'}
          </Editable>
        )}

        {error && <p className="register__error" role="alert">{error}</p>}

        {step < 3 ? (
          <form className="register__form" onSubmit={saveAndAdvance}>
            {step === 0 && (
              <>
                <label>
                  <FieldLabel name="camperName">Camper&rsquo;s full name</FieldLabel>
                  <input
                    type="text" name="camperName" required value={fields.camperName}
                    onChange={(e) => set('camperName', e.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel name="camperDob">Date of birth</FieldLabel>
                  <input
                    type="date" name="camperDob" required value={fields.camperDob}
                    onChange={(e) => set('camperDob', e.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel name="camperSchool">School</FieldLabel>
                  <input
                    type="text" name="camperSchool" value={fields.camperSchool}
                    onChange={(e) => set('camperSchool', e.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel name="camperGrade">Grade in the autumn</FieldLabel>
                  <input
                    type="text" name="camperGrade" value={fields.camperGrade}
                    onChange={(e) => set('camperGrade', e.target.value)}
                  />
                </label>
              </>
            )}

            {step === 1 && (
              <>
                <label>
                  <FieldLabel name="guardianName">Parent or guardian</FieldLabel>
                  <input
                    type="text" name="guardianName" required value={fields.guardianName}
                    onChange={(e) => set('guardianName', e.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel name="guardianEmail">Email</FieldLabel>
                  <input
                    type="email" name="guardianEmail" required autoComplete="email"
                    value={fields.guardianEmail}
                    onChange={(e) => set('guardianEmail', e.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel name="guardianPhone">Phone</FieldLabel>
                  <input
                    type="tel" name="guardianPhone" required autoComplete="tel"
                    value={fields.guardianPhone}
                    onChange={(e) => set('guardianPhone', e.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel name="addressLine1">Address</FieldLabel>
                  <input
                    type="text" name="addressLine1" autoComplete="address-line1"
                    value={fields.addressLine1}
                    onChange={(e) => set('addressLine1', e.target.value)}
                  />
                </label>
                <div className="register__row">
                  <label>
                    <FieldLabel name="addressCity">Town</FieldLabel>
                    <input
                      type="text" name="addressCity" autoComplete="address-level2"
                      value={fields.addressCity}
                      onChange={(e) => set('addressCity', e.target.value)}
                    />
                  </label>
                  <label>
                    <FieldLabel name="addressState">State</FieldLabel>
                    <input
                      type="text" name="addressState" autoComplete="address-level1"
                      value={fields.addressState}
                      onChange={(e) => set('addressState', e.target.value)}
                    />
                  </label>
                  <label>
                    <FieldLabel name="addressPostal">ZIP</FieldLabel>
                    <input
                      type="text" name="addressPostal" autoComplete="postal-code"
                      value={fields.addressPostal}
                      onChange={(e) => set('addressPostal', e.target.value)}
                    />
                  </label>
                </div>
                <Editable
                  id="register.emergency.heading"
                  as="h2"
                  className="register__subheading"
                >
                  Someone else we can reach in an emergency
                </Editable>
                <label>
                  <FieldLabel name="emergencyName">Name</FieldLabel>
                  <input
                    type="text" name="emergencyName" required value={fields.emergencyName}
                    onChange={(e) => set('emergencyName', e.target.value)}
                  />
                </label>
                <label>
                  <FieldLabel name="emergencyPhone">Phone</FieldLabel>
                  <input
                    type="tel" name="emergencyPhone" required value={fields.emergencyPhone}
                    onChange={(e) => set('emergencyPhone', e.target.value)}
                  />
                </label>
              </>
            )}

            {step === 2 && (
              <>
                <label>
                  <FieldLabel name="busRoute">Getting to camp</FieldLabel>
                  <select
                    name="busRoute" value={fields.busRoute}
                    onChange={(e) => set('busRoute', e.target.value)}
                  >
                    {/* `as="option"` rather than a wrapper inside it: an
                        <option> may only contain text, so an inner span
                        would be invalid and break the select. */}
                    <Editable id="register.bus.none" as="option" value="">
                      We will bring them ourselves
                    </Editable>
                    {BUS_ROUTES.map((bus) => (
                      <option key={bus.key} value={bus.key}>
                        {bus.region} — {bus.stops} (${bus.price})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <FieldLabel name="shirtSize">T-shirt size</FieldLabel>
                  <select
                    name="shirtSize" value={fields.shirtSize}
                    onChange={(e) => set('shirtSize', e.target.value)}
                  >
                    <Editable id="register.shirt.placeholder" as="option" value="">
                      Choose a size
                    </Editable>
                    {SHIRT_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
                <Editable
                  id="register.options.heading"
                  as="h2"
                  className="register__subheading"
                >
                  Two things to decide
                </Editable>

                <label className="register__check">
                  <input
                    type="checkbox" name="insurance" checked={fields.insurance}
                    onChange={(e) => set('insurance', e.target.checked)}
                  />
                  <span>
                    {/* Both strings quote the cover price, so both are
                        templates: change INSURANCE and the wording follows,
                        including any rewrite saved on top of it. */}
                    <Editable
                      id="register.insurance.label"
                      as="span"
                      vars={{ insurance: `$${INSURANCE}` }}
                    >
                      {'Add cancellation cover, {insurance}'}
                    </Editable>
                    <Editable
                      id="register.insurance.note"
                      as="span"
                      className="register__check-note"
                      vars={{ insurance: `$${INSURANCE}` }}
                    >
                      {'Cancel before camp starts and every camp fee comes back, ' +
                        'deposit and bus included. The {insurance} is not ' +
                        'returned. Without cover the deposit is not refundable, ' +
                        'and nothing is refunded from July 1.'}
                    </Editable>
                  </span>
                </label>

                <label className="register__check">
                  <input
                    type="checkbox" name="photoConsent" checked={fields.photoConsent}
                    onChange={(e) => set('photoConsent', e.target.checked)}
                  />
                  <span>
                    <Editable id="register.photo.label" as="span">
                      Photos and name tagging
                    </Editable>
                    <Editable
                      id="register.photo.note"
                      as="span"
                      className="register__check-note"
                    >
                      {'You may use photos of my child on the camp website and ' +
                        'tag them by name. Left unticked we tag nothing; you can ' +
                        'change your mind by telling a director.'}
                    </Editable>
                  </span>
                </label>
              </>
            )}

            <div className="register__actions">
              {step > 0 && (
                <button
                  type="button" className="register__back"
                  onClick={() => setStep((current) => current - 1)}
                >
                  <Editable id="register.back" as="span">Back</Editable>
                </button>
              )}
              {/* Only the resting label is editable. The busy text is a
                  transient state nobody can click on to select, so an override
                  on it would be unreachable from the editor — and a saved
                  "Saving…" would be indistinguishable from a stuck form. */}
              <button type="submit" className="register__next" disabled={busy}>
                {busy ? 'Saving…' : <Editable id="register.continue" as="span">Continue</Editable>}
              </button>
            </div>
          </form>
        ) : (
          <div className="register__summary">
            {/* Only when there is a price. With registration closed the
                heading announced a table that never came. */}
            {quote && (
              <Editable id="register.summary.heading" as="h2" className="register__subheading">
                What you will pay
              </Editable>
            )}

            {quote ? (
              <>
                <dl className="register__prices">
                  {/* The tier name comes back with the quote the server
                      computed, so it stays unwrapped for the reason the
                      figures beside it do: a retypable tier would be a
                      second, disagreeing answer about what is being
                      charged. Rename a tier in src/data/registration.js,
                      where pricing.js reads it. */}
                  <div><dt>{quote.tier}</dt><dd>{money(quote.baseCents)}</dd></div>
                  {quote.busCents > 0 && (
                    <div>
                      <dt><Editable id="register.line.bus" as="span">Bus</Editable></dt>
                      <dd>{money(quote.busCents)}</dd>
                    </div>
                  )}
                  {quote.siblingDiscountCents > 0 && (
                    <div>
                      <dt>
                        <Editable id="register.line.sibling" as="span">Sibling discount</Editable>
                      </dt>
                      <dd>&minus;{money(quote.siblingDiscountCents)}</dd>
                    </div>
                  )}
                  {quote.insuranceCents > 0 && (
                    <div>
                      <dt>
                        <Editable id="register.line.insurance" as="span">Cancellation cover</Editable>
                      </dt>
                      <dd>{money(quote.insuranceCents)}</dd>
                    </div>
                  )}
                  <div className="register__prices-total">
                    <dt><Editable id="register.line.total" as="span">Total</Editable></dt>
                    <dd>{money(quote.totalCents)}</dd>
                  </div>
                </dl>

                {/* The split, kept apart from the fee lines above: those say
                    what camp costs, this says when it is paid. Run together
                    in one list, Total read as one row among six. */}
                <dl className="register__split">
                  <div className="register__split-now">
                    <dt><Editable id="register.line.due-today" as="span">Due today</Editable></dt>
                    <dd>{money(quote.depositCents)}</dd>
                  </div>
                  {quote.balanceDueCents > 0 && (
                    <div>
                      <dt>
                        <Editable
                          id="register.line.balance"
                          as="span"
                          vars={{ date: readableDate(quote.balanceDueAt) }}
                        >
                          {'Then {date}'}
                        </Editable>
                      </dt>
                      <dd>{money(quote.balanceDueCents)}</dd>
                    </div>
                  )}
                </dl>

                {quote.insuranceCents === 0 && (
                  <Editable id="register.no-refund-hint" as="p" className="register__hint">
                    The deposit is not refundable.
                  </Editable>
                )}
                <div className="register__actions">
                  <button
                    type="button" className="register__back"
                    onClick={() => setStep(2)}
                  >
                    <Editable id="register.summary.back" as="span">Back</Editable>
                  </button>
                  {/* The words are editable, the amount is not. `{deposit}` is
                      filled from the server's quote on every render, so this
                      button can never advertise a figure that differs from what
                      Stripe is about to charge. */}
                  <button
                    type="button" className="register__next"
                    onClick={startCheckout} disabled={busy}
                  >
                    {busy ? 'Opening payment…' : (
                      <Editable
                        id="register.pay"
                        as="span"
                        vars={{ deposit: money(quote.depositCents) }}
                      >
                        {'Pay {deposit} deposit'}
                      </Editable>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* The banner above already says registration is closed, so
                    this only adds what is new here: the form is saved. */}
                <Editable id="register.nothing-to-pay" as="p" className="register__notice">
                  There is nothing to pay yet. We have kept what you filled in.
                </Editable>
                {/* Without this there is no way back off the last step, and
                    someone who mistyped a name is stranded. */}
                <div className="register__actions">
                  <button
                    type="button" className="register__back"
                    onClick={() => setStep(2)}
                  >
                    <Editable id="register.closed.back" as="span">Back</Editable>
                  </button>
                </div>
              </>
            )}

            {/* Only the reference itself here. The sentence about ringing
                the camp belongs on the confirmation, where it is the one
                thing worth keeping — repeating it on both read as filler. */}
            {reference && (
              <p className="register__hint">
                <Editable id="register.reference-label" as="span">Reference</Editable>{' '}
                <strong>{reference}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
