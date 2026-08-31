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
              <img
                className="merch-store__image"
                src={product.images[0]}
                alt={product.name}
                width="600"
                height="600"
                loading="lazy"
              />
            )}
            <h3 className="merch-store__name">{product.name}</h3>
            {typeof product.price === 'number' && (
              <p className="merch-store__price">${(product.price / 100).toFixed(2)}</p>
            )}
            {product.description && (
              <p className="merch-store__note">{product.description}</p>
            )}
            <Button
              href={`https://shop.bmxc.camp/product/${product.id}`}
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
