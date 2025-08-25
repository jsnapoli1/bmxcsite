const products = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  image: `https://via.placeholder.com/150?text=Product+${i + 1}`
}));

export default function Merch() {
  return (
    <div>
      <h1>Merch</h1>
      <div className="product-grid">
        {products.map((product) => (
          <div key={product.id} className="product-card">
            <img src={product.image} alt={product.name} />
            <p>{product.name}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
