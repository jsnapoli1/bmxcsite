import { useEffect, useState } from 'react';
import { listRegistrations, cancelRegistration } from '../lib/api.js';
import { Busy, Failure, Empty } from '../components/States.jsx';

/**
 * Camp registrations.
 *
 * Read-mostly on purpose. Payment state belongs to Stripe and the
 * webhook — an admin marking someone paid by hand would make this
 * database disagree with the money, and the disagreement would be
 * invisible until someone reconciled by eye.
 */

const STATUSES = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'draft', label: 'Started, not paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

function money(cents) {
  if (cents === null || cents === undefined) return '—';
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

export default function Registrations() {
  const [status, setStatus] = useState('confirmed');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function refresh(which = status) {
    const { registrations } = await listRegistrations(which);
    setRows(registrations);
  }

  useEffect(() => {
    setRows(null);
    refresh(status).catch((err) => { setError(err.message); setRows([]); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function handleCancel(row) {
    // Name what the family is owed. Refunds are issued by hand in Stripe,
    // so this screen is the only place the policy and the money meet — a
    // director should not have to remember who bought cover.
    const owed = row.insurance === 1
      ? `They bought cancellation cover, so every camp fee is refundable `
        + `up to the first day of camp: ${money(row.deposit_paid_cents)} paid `
        + `so far. The $50 cover itself is not refunded.`
      : `They did not buy cancellation cover, so the ordinary policy `
        + `applies: the deposit is not refundable, and nothing is refunded `
        + `from July 1.`;

    const confirmed = window.confirm(
      `Cancel ${row.camper_name}'s registration (${row.reference})?\n\n`
      + `${owed}\n\n`
      + 'This does not move any money. Issue the refund in Stripe.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await cancelRegistration(row.reference);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-section" aria-labelledby="registrations-heading">
      <h2 id="registrations-heading">Registrations</h2>
      <p className="admin-help">
        Who is coming to camp. Payments are recorded by Stripe &mdash; this
        page shows what was paid, but cannot change it.
      </p>

      <Failure message={error} />

      <div className="album-bar__filters" role="group" aria-label="Filter by status">
        {STATUSES.map((option) => (
          <button
            key={option.key}
            type="button"
            className={status === option.key ? 'album-chip album-chip--active' : 'album-chip'}
            aria-pressed={status === option.key}
            onClick={() => setStatus(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {rows === null ? <Busy /> : (
        <>
          {rows.length === 0 ? (
            <Empty>Nothing here yet.</Empty>
          ) : (
            <>
              <p className="admin-help">
                {rows.length} {rows.length === 1 ? 'registration' : 'registrations'}.
              </p>
              <p>
                {/* Styled like the Email tab's export rather than left as a
                    bare anchor: the browser default is #00EE blue, which is
                    not in this palette. */}
                <a className="admin-add" href="/api/admin/registrations/export.csv" download>
                  Download CSV
                </a>
              </p>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Camper</th>
                    <th scope="col">Guardian</th>
                    <th scope="col">Bus</th>
                    <th scope="col">Paid</th>
                    <th scope="col">Balance</th>
                    <th scope="col">Cover</th>
                    <th scope="col">Tagging</th>
                    <th scope="col"><span className="visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.reference}>
                      <th scope="row">
                        <span className="admin-person-name">{row.camper_name ?? '—'}</span>
                        <span className="admin-person-email">{row.reference}</span>
                      </th>
                      <td data-label="Guardian">
                        <span className="admin-person-name">{row.guardian_name ?? '—'}</span>
                        <span className="admin-person-email">{row.guardian_email ?? ''}</span>
                      </td>
                      <td data-label="Bus">{row.bus_route ? row.bus_route.toUpperCase() : 'Own transport'}</td>
                      <td data-label="Paid">{money(row.deposit_paid_cents)}</td>
                      <td data-label="Balance">{money(row.balance_due_cents)}</td>
                      <td data-label="Cover">
                        {row.insurance === 1 ? 'Refundable' : 'No cover'}
                      </td>
                      <td data-label="Tagging">
                        {row.photo_consent === 1 ? 'Allowed' : 'No consent'}
                      </td>
                      <td>
                        {row.status !== 'cancelled' && (
                          <button
                            type="button"
                            className="admin-remove"
                            disabled={busy}
                            onClick={() => handleCancel(row)}
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </section>
  );
}
