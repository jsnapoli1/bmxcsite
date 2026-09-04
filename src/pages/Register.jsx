import { useEffect, useState } from 'react';
import { BUS_ROUTES } from '../data/registration.js';
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
 */

const STORAGE_KEY = 'bmxc:registration-reference';

const STEPS = ['Camper', 'Guardian', 'Options', 'Pay'];

const SHIRT_SIZES = ['YS', 'YM', 'YL', 'AS', 'AM', 'AL', 'AXL'];

function money(cents) {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
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
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [fields, setFields] = useState({
    camperName: '', camperDob: '', camperSchool: '', camperGrade: '',
    guardianName: '', guardianEmail: '', guardianPhone: '',
    addressLine1: '', addressCity: '', addressState: '', addressPostal: '',
    emergencyName: '', emergencyPhone: '',
    busRoute: '', shirtSize: '', photoConsent: false,
  });

  // Resume an unfinished registration. A guardian who closed the tab
  // should not have to type it all again.
  useEffect(() => {
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

  return (
    <main className="register">
      <div className="register__inner">
        <h1 className="register__title">Register for camp</h1>

        <ol className="register__steps" aria-label="Registration steps">
          {STEPS.map((label, index) => (
            <li
              key={label}
              className={index === step ? 'register__step register__step--current' : 'register__step'}
              aria-current={index === step ? 'step' : undefined}
            >
              {label}
            </li>
          ))}
        </ol>

        {!open && (
          <p className="register__notice">
            Registration is closed for this year. You can still fill this in
            and we will hold it, but payment opens when registration does.
          </p>
        )}

        {error && <p className="register__error" role="alert">{error}</p>}

        {step < 3 ? (
          <form className="register__form" onSubmit={saveAndAdvance}>
            {step === 0 && (
              <>
                <label>
                  Camper&rsquo;s full name
                  <input
                    type="text" name="camperName" required value={fields.camperName}
                    onChange={(e) => set('camperName', e.target.value)}
                  />
                </label>
                <label>
                  Date of birth
                  <input
                    type="date" name="camperDob" required value={fields.camperDob}
                    onChange={(e) => set('camperDob', e.target.value)}
                  />
                </label>
                <label>
                  School
                  <input
                    type="text" name="camperSchool" value={fields.camperSchool}
                    onChange={(e) => set('camperSchool', e.target.value)}
                  />
                </label>
                <label>
                  Grade in the autumn
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
                  Parent or guardian
                  <input
                    type="text" name="guardianName" required value={fields.guardianName}
                    onChange={(e) => set('guardianName', e.target.value)}
                  />
                </label>
                <label>
                  Email
                  <input
                    type="email" name="guardianEmail" required autoComplete="email"
                    value={fields.guardianEmail}
                    onChange={(e) => set('guardianEmail', e.target.value)}
                  />
                </label>
                <label>
                  Phone
                  <input
                    type="tel" name="guardianPhone" required autoComplete="tel"
                    value={fields.guardianPhone}
                    onChange={(e) => set('guardianPhone', e.target.value)}
                  />
                </label>
                <label>
                  Address
                  <input
                    type="text" name="addressLine1" autoComplete="address-line1"
                    value={fields.addressLine1}
                    onChange={(e) => set('addressLine1', e.target.value)}
                  />
                </label>
                <div className="register__row">
                  <label>
                    Town
                    <input
                      type="text" name="addressCity" autoComplete="address-level2"
                      value={fields.addressCity}
                      onChange={(e) => set('addressCity', e.target.value)}
                    />
                  </label>
                  <label>
                    State
                    <input
                      type="text" name="addressState" autoComplete="address-level1"
                      value={fields.addressState}
                      onChange={(e) => set('addressState', e.target.value)}
                    />
                  </label>
                  <label>
                    ZIP
                    <input
                      type="text" name="addressPostal" autoComplete="postal-code"
                      value={fields.addressPostal}
                      onChange={(e) => set('addressPostal', e.target.value)}
                    />
                  </label>
                </div>
                <h2 className="register__subheading">
                  Someone else we can reach in an emergency
                </h2>
                <label>
                  Name
                  <input
                    type="text" name="emergencyName" required value={fields.emergencyName}
                    onChange={(e) => set('emergencyName', e.target.value)}
                  />
                </label>
                <label>
                  Phone
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
                  Getting to camp
                  <select
                    name="busRoute" value={fields.busRoute}
                    onChange={(e) => set('busRoute', e.target.value)}
                  >
                    <option value="">We will bring them ourselves</option>
                    {BUS_ROUTES.map((bus) => (
                      <option key={bus.key} value={bus.key}>
                        {bus.region} — {bus.stops} (${bus.price})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  T-shirt size
                  <select
                    name="shirtSize" value={fields.shirtSize}
                    onChange={(e) => set('shirtSize', e.target.value)}
                  >
                    <option value="">Choose a size</option>
                    {SHIRT_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </label>
                <label className="register__check">
                  <input
                    type="checkbox" name="photoConsent" checked={fields.photoConsent}
                    onChange={(e) => set('photoConsent', e.target.checked)}
                  />
                  <span>
                    You may use photos of my child on the camp website, and
                    tag them by name so we can find their pictures.
                  </span>
                </label>
                <p className="register__hint">
                  Leave this unticked and we will not tag your child in any
                  photograph. You can change your mind by telling a director.
                </p>
              </>
            )}

            <div className="register__actions">
              {step > 0 && (
                <button
                  type="button" className="register__back"
                  onClick={() => setStep((current) => current - 1)}
                >
                  Back
                </button>
              )}
              <button type="submit" className="register__next" disabled={busy}>
                {busy ? 'Saving…' : 'Continue'}
              </button>
            </div>
          </form>
        ) : (
          <div className="register__summary">
            <h2 className="register__subheading">What you will pay</h2>

            {quote ? (
              <>
                <dl className="register__prices">
                  <div><dt>{quote.tier}</dt><dd>{money(quote.baseCents)}</dd></div>
                  {quote.busCents > 0 && (
                    <div><dt>Bus</dt><dd>{money(quote.busCents)}</dd></div>
                  )}
                  {quote.siblingDiscountCents > 0 && (
                    <div>
                      <dt>Sibling discount</dt>
                      <dd>&minus;{money(quote.siblingDiscountCents)}</dd>
                    </div>
                  )}
                  <div className="register__prices-total">
                    <dt>Total</dt><dd>{money(quote.totalCents)}</dd>
                  </div>
                  <div><dt>Due now (deposit)</dt><dd>{money(quote.depositCents)}</dd></div>
                  <div>
                    <dt>Balance, due {quote.balanceDueAt}</dt>
                    <dd>{money(quote.balanceDueCents)}</dd>
                  </div>
                </dl>
                <p className="register__hint">
                  The deposit is non-refundable and holds your place.
                </p>
                <div className="register__actions">
                  <button
                    type="button" className="register__back"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </button>
                  <button
                    type="button" className="register__next"
                    onClick={startCheckout} disabled={busy}
                  >
                    {busy ? 'Opening payment…' : `Pay ${money(quote.depositCents)} deposit`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="register__notice">
                  Registration is closed for this year, so there is nothing to
                  pay yet. We have kept what you filled in
                  {reference ? ` under reference ${reference}` : ''}.
                </p>
                {/* Without this there is no way back off the last step, and
                    someone who mistyped a name is stranded. */}
                <div className="register__actions">
                  <button
                    type="button" className="register__back"
                    onClick={() => setStep(2)}
                  >
                    Back
                  </button>
                </div>
              </>
            )}

            {reference && (
              <p className="register__hint">
                Your reference is <strong>{reference}</strong>. Keep it if you
                need to ring the camp about this registration.
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
