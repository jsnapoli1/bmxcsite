import { Editable, EditableImage } from 'vedit';
import { useEffect, useState } from 'react';
import SectionHeading from '../ui/SectionHeading.jsx';
import Reveal from '../motion/Reveal.jsx';
import Button from '../ui/Button.jsx';

/**
 * The online store's catalogue, read from the OpenShop worker.
 *
 * Renders nothing at all when the store has no products. That is the state
 * today and the state whenever the store is down, and an empty grid with a
 * "no products" message would be worse than the section simply not being
 * there — the rest of the merch page still tells people how to buy at camp.
 *
 * **Checkout is deliberately absent.** OpenShop has no Stripe key, so a Buy
 * button would take an order nothing can charge. Each product links to the
 * store, which is where a purchase will happen once real keys exist. Adding
 * a cart here before then would be a checkout that silently fails.
 */
/**
 * The store's public origin.
 *
 * Product images and links come back from the API as root-relative paths
 * (`/api/images/…`, and `/products/<id>` is served over there too). Rendered
 * on bmxc.camp they would resolve against *this* origin and 404 — the images
 * live in the store's own R2 bucket, served back through its worker.
 */
const SHOP_ORIGIN = 'https://shop.bmxc.camp';

/** Resolve a store-relative path against the store, leaving absolute URLs be. */
function shopUrl(path) {
  if (!path) return path;
  return /^https?:\/\//.test(path) ? path : `${SHOP_ORIGIN}${path}`;
}

export default function MerchStore({ id = 'merch.store', ...rest }) {
  const headingId = `${id}-heading`;
  const [products, setProducts] = useState([]);

  useEffect(() => {
    let active = true;
    fetch('/api/shop/products', { headers: { accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : []))
      .then((list) => { if (active) setProducts(Array.isArray(list) ? list : []); })
      .catch(() => {
        // The store being unreachable is not something a visitor to a camp
        // site needs told; the page below still explains how to buy.
      });
    return () => { active = false; };
  }, []);

  if (products.length === 0) return null;

  return (
    <section {...rest} className="section container merch-store" aria-labelledby={headingId}>
      <SectionHeading
        id={id}
        headingId={headingId}
        eyebrow="Online"
        title="Order online"
        lead="Shipped to you. Camp merch is also sold in person during camp week — see below."
        as="h2"
      />

      <ul className="merch-store__grid">
        {products.map((product, index) => (
          <Reveal
            as="li"
            key={product.id}
            delay={Math.min(index, 5) * 45}
            className="merch-store__item"
          >
            {product.images?.[0] && (
              <EditableImage
                id={`merch.store.item.${product.id}.image`}
                as="img"
                className="merch-store__image"
                src={shopUrl(product.images[0])}
                alt={product.name}
                width="600"
                height="600"
                loading="lazy"
              />
            )}
            {/* Keyed on product.id from the store's own catalogue.
                The price stays unwrapped for the reason tier.price is:
                OpenShop charges it, and a retypable figure would be a
                second, disagreeing answer. */}
            <Editable
              id={`merch.store.item.${product.id}.name`}
              as="h3"
              className="merch-store__name"
            >
              {product.name}
            </Editable>
            {typeof product.price === 'number' && (
              <p className="merch-store__price">${(product.price / 100).toFixed(2)}</p>
            )}
            {product.description && (
              <Editable
                id={`merch.store.item.${product.id}.description`}
                as="p"
                className="merch-store__note"
              >
                {product.description}
              </Editable>
            )}
            <Button
              id={`merch.store.item.${product.id}.cta`}
              href={`${SHOP_ORIGIN}/products/${product.id}`}
              variant="ghost"
            >
              View in the store →
            </Button>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
