import { useEffect, useState } from 'react';
import {
  listAddresses, createAddress, deleteAddress,
  listDestinations, createDestination, listSubscribers,
} from '../lib/api.js';
import { Busy, Failure, Empty } from '../components/States.jsx';

/**
 * Staff @bmxc.camp addresses, and the subscriber list.
 *
 * Verification state is shown rather than hidden: Cloudflare emails every
 * new destination a link, and until someone clicks it mail forwarded there
 * silently does not arrive. "Why am I not getting anything" should have an
 * answer on this page instead of in the Cloudflare dashboard.
 */
export default function Email() {
  const [addresses, setAddresses] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState('');
  const [destination, setDestination] = useState('');

  async function refresh() {
    const [a, d, s] = await Promise.all([
      listAddresses(), listDestinations(), listSubscribers(),
    ]);
    setAddresses(a.addresses);
    setDestinations(d.destinations);
    setSubscribers(s.subscribers);
  }

  useEffect(() => {
    // Settle `addresses` even on failure, so the page renders its error
    // instead of sitting on the loading state forever.
    refresh().catch((err) => { setError(err.message); setAddresses([]); });
  }, []);

  const verifiedByEmail = new Map(destinations.map((row) => [row.email, row.verified]));

  async function handleCreate(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The destination must exist as an account destination before a rule
      // can forward to it. Creating it here is what triggers Cloudflare's
      // verification email.
      if (!verifiedByEmail.has(destination)) {
        await createDestination({ email: destination });
      }
      await createAddress({ address: `${local}@bmxc.camp`, destination });
      setLocal('');
      setDestination('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(row) {
    const confirmed = window.confirm(
      `Delete ${row.address}? Mail sent to it will stop being forwarded to `
      + `${row.destination}. Anyone who has that address will need a new one.`,
    );
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await deleteAddress(row.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (addresses === null) return <Busy />;

  return (
    <section className="admin-section" aria-labelledby="email-heading">
      <h2 id="email-heading">Email</h2>
      <p className="admin-help">
        A camp address forwards to someone&rsquo;s own inbox. Cloudflare
        emails each new inbox a link to confirm &mdash; until that is
        clicked, mail sent to the camp address will not arrive.
      </p>

      <Failure message={error} />

      <form className="admin-invite" onSubmit={handleCreate}>
        <label>
          Camp address
          <input
            type="text"
            name="local"
            required
            value={local}
            placeholder="ken"
            onChange={(event) => setLocal(event.target.value)}
          />
        </label>
        <span className="email-domain">@bmxc.camp</span>
        <label>
          Forwards to
          <input
            type="email"
            name="destination"
            required
            value={destination}
            placeholder="ken@gmail.com"
            onChange={(event) => setDestination(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy || local.trim() === ''}>
          Add address
        </button>
      </form>

      <h3 className="admin-subheading">Camp addresses</h3>
      {addresses.length === 0 ? (
        <Empty>No camp addresses yet.</Empty>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Address</th>
              <th scope="col">Forwards to</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="visually-hidden">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {addresses.map((row) => (
              <tr key={row.id}>
                <th scope="row">{row.address}</th>
                <td data-label="Forwards to">{row.destination}</td>
                <td data-label="Status">
                  {verifiedByEmail.get(row.destination)
                    ? 'Delivering'
                    : 'Waiting for the inbox to confirm'}
                </td>
                <td>
                  <button
                    type="button"
                    className="admin-remove"
                    disabled={busy}
                    onClick={() => handleDelete(row)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h3 className="admin-subheading">Subscribers</h3>
      <p className="admin-help">
        People who asked for camp news and confirmed it. Announcements are
        not sent from here &mdash; download the list and send from whatever
        you normally use.
      </p>
      {subscribers.length === 0 ? (
        <Empty>Nobody has confirmed a subscription yet.</Empty>
      ) : (
        <>
          <p className="admin-help">{subscribers.length} confirmed.</p>
          <a className="admin-add" href="/api/admin/email/subscribers.csv" download>
            Download CSV
          </a>
        </>
      )}
    </section>
  );
}
