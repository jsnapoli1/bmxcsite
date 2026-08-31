import { useEffect, useState } from 'react';
import { listShopProducts, deleteShopProduct } from '../lib/api.js';

/**
 * The merch store's catalogue, served by the OpenShop worker.
 *
 * Deliberately read-mostly. OpenShop ships its own admin UI with product
 * editing, variants, image handling and Stripe sync, and rebuilding that here
 * would mean maintaining two versions of the same forms against an API this
 * repo does not own. What belongs in this panel is the part a camp director
 * needs alongside everything else: what is in the store, what it costs, and a
 * way to remove something quickly.
 *
 * Anything more involved links out to OpenShop's own admin, which is one
 * sign-in away and always current with whatever version is deployed.
 *
 * Separate from the Merch tab on purpose: that one edits the informational
 * merch page in D1 (cash only, sold at camp), which is still what the public
 * site shows. This is the store behind it. Conflating them would suggest
 * editing one changes the other.
 */
export default function Store() {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  async function refresh() {
    setProducts(await listShopProducts());
  }

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, []);

  async function remove(product) {
    // Deleting a product also detaches it from Stripe upstream, so it is
    // worth a confirmation even though the list is short.
    const label = product.name ?? product.id;
    // eslint-disable-next-line no-alert
    if (!window.confirm(`Remove “${label}” from the store?`)) return;

    setBusy(product.id);
    setError(null);
    try {
      await deleteShopProduct(product.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <section className="admin-section" aria-labelledby="store-heading">
        <h2 id="store-heading">Store</h2>
        <p className="admin-notice">{error}</p>
        <p className="admin-help">
          The store runs as a separate service. If this keeps failing, it may
          be down or not yet configured.
        </p>
      </section>
    );
  }

  return (
    <section className="admin-section" aria-labelledby="store-heading">
      <h2 id="store-heading">Store</h2>

      <p className="admin-help">
        Products sold through the online store. Adding a product, editing its
        images or setting up variants happens in the store’s own admin; this
        is here so you can see the catalogue without leaving the panel.
      </p>

      {products === null && <p className="admin-notice" aria-busy="true">Loading…</p>}

      {products?.length === 0 && (
        <p className="admin-notice">
          The store has no products yet.
        </p>
      )}

      {products?.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <th scope="row">{product.name ?? product.id}</th>
                <td>
                  {typeof product.price === 'number'
                    ? `$${(product.price / 100).toFixed(2)}`
                    : '—'}
                </td>
                <td>{product.archived ? 'Archived' : 'Live'}</td>
                <td>
                  <button
                    type="button"
                    className="admin-remove"
                    onClick={() => remove(product)}
                    disabled={busy === product.id}
                    aria-busy={busy === product.id}
                  >
                    {busy === product.id ? 'Removing…' : 'Remove'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
