import { Link } from "react-router-dom";
import type { Product } from "../services/types";

export function ProductCard({ product }: { product: Product }) {
  return (
    <Link className="product-card" to={`/productos/${product.id}`}>
      <div className="product-image-wrap">
        {product.image_url ? (
          <img src={product.image_url} alt="" className="product-image" loading="lazy" />
        ) : (
          <div className="product-placeholder" aria-hidden="true">
            <span>{product.name.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
        <span className="card-arrow">↗</span>
      </div>
      <div className="product-card-body">
        <span className="product-category">{product.category?.name ?? "Producto seguido"}</span>
        <h3>{product.name}</h3>
        <p>{product.brand ? `${product.brand} · ` : ""}{product.quantity} {product.unit}</p>
      </div>
    </Link>
  );
}
