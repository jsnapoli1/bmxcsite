import { useEffect, useState } from 'react';
import {
  listCampers, saveCamper, recordConsent, withdrawConsent,
} from '../lib/api.js';
import { Busy, Failure, Empty } from '../components/States.jsx';

/**
 * The camp roster and its consent record.
 *
 * Consent is the whole point of this page. A camper without it is not
 * merely untagged — their name is never sent to the face service at all,
 * so no template is ever built from their face.
 */
export default function Faces() {
  const [campers, setCampers] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [bib, setBib] = useState('');
  const [name, setName] = useState('');

  async function refresh() {
    const { campers: rows } = await listCampers();
    setCampers(rows);
  }

  useEffect(() => {
    // Settle the list even on failure, so the page shows its error rather
    // than sitting on the loading state.
    refresh().catch((err) => { setError(err.message); setCampers([]); });
  }, []);

  async function handleAdd(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveCamper({ bib, name });
      setBib('');
      setName('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleConsent(camper) {
    const consenting = camper.consent_at === null;

    const confirmed = window.confirm(consenting
      ? `Record that ${camper.name}'s family has agreed to face tagging? `
        + 'Only do this if you have their consent — it lets their name be '
        + 'attached to photographs automatically.'
      : `Withdraw consent for ${camper.name}? Their name stops being used `
        + 'for tagging, and the tags built from it go at the next rebuild.');
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      if (consenting) await recordConsent(camper.bib);
      else await withdrawConsent(camper.bib);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (campers === null) return <Busy />;

  const consenting = campers.filter((camper) => camper.consent_at !== null).length;

  return (
    <section className="admin-section" aria-labelledby="faces-heading">
      <h2 id="faces-heading">Face tagging</h2>
      <p className="admin-help">
        Photos can be tagged with a camper&rsquo;s name automatically, from
        the bib number in the picture. This only happens for campers whose
        family has agreed &mdash; everyone else is never sent to the
        tagging service at all.
      </p>

      <Failure message={error} />

      <form className="admin-invite" onSubmit={handleAdd}>
        <label>
          Bib
          <input
            type="text"
            name="bib"
            required
            value={bib}
            placeholder="101"
            onChange={(event) => setBib(event.target.value)}
          />
        </label>
        <label>
          Name
          <input
            type="text"
            name="camperName"
            required
            value={name}
            placeholder="Alex Kim"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <button type="submit" disabled={busy || bib.trim() === '' || name.trim() === ''}>
          Add camper
        </button>
      </form>

      {campers.length === 0 ? (
        <Empty>No campers on the roster yet.</Empty>
      ) : (
        <>
          <p className="admin-help">
            {consenting} of {campers.length} may be tagged.
          </p>
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Bib</th>
                <th scope="col">Name</th>
                <th scope="col">May be tagged</th>
                <th scope="col"><span className="visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {campers.map((camper) => (
                <tr key={camper.bib}>
                  <th scope="row">{camper.bib}</th>
                  <td data-label="Name">{camper.name}</td>
                  <td data-label="May be tagged">
                    {camper.consent_at === null ? 'No — no consent recorded' : 'Yes'}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="admin-remove"
                      disabled={busy}
                      onClick={() => handleToggleConsent(camper)}
                    >
                      {camper.consent_at === null ? 'Record consent' : 'Withdraw'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
