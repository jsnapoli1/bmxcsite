// Add merch items here. `image` can be any image URL, or omitted entirely.
// Example: { id: 'tee-2026', name: 'Camp Tee', image: '/bmxcsite/merch/tee.jpg' }
const products = [];

export default function Merch() {
  return (
    <div>
      <h1>Merch</h1>
      {products.length === 0 ? (
        <p className="empty-state">Camp merch is on the way — check back soon.</p>
      ) : (
        <div className="product-grid">
          {products.map((product) => (
            <div key={product.id} className="product-card">
              {product.image && <img src={product.image} alt={product.name} />}
              <p>{product.name}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
