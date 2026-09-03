import type { MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { NormalizedProductImage } from "./NormalizedProductImage";
import { StoreLogo } from "./StoreLogo";
import type { ProductEntryNavigationState } from "../services/navigation";
import type { Product } from "../services/types";

function money(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 0 }).format(value);
}

export function ProductCard({ product, returnPage = 0 }: { product: Product; returnPage?: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const hasPrice = typeof product.current_price === "number";
  const comparisonLabel = product.comparison_count === 1
    ? "1 cadena comparada"
    : product.comparison_count
      ? `${product.comparison_count} cadenas comparadas`
      : "Sin precios recientes";
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const navigationState: ProductEntryNavigationState = {
      returnTo: `${location.pathname}${location.search}${location.hash}`,
      returnScrollY: window.scrollY,
      returnPage,
    };
    navigate(`/productos/${product.id}`, { state: navigationState });
  };

  return (
    <Link className="product-card" to={`/productos/${product.id}`} onClick={handleClick}>
      <div className="product-image-wrap">
        {product.image_url ? (
          <NormalizedProductImage src={product.image_url} />
        ) : (
          <div className="product-placeholder" aria-hidden="true">
            <span>{product.name.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
        <span className="card-arrow">↗</span>
        <span className="card-image-label"><span className="live-dot" />{comparisonLabel}</span>
      </div>
      <div className="product-card-body">
        <div className="card-topline"><span className="product-category">{product.category?.name ?? "Producto seguido"}</span>{product.best_store ? <span className="card-store"><StoreLogo name={product.best_store} compact /><span>{product.best_store}</span></span> : <span className="card-open">Ver detalle</span>}</div>
        <h3>{product.name}</h3>
        <p>{product.brand ? `${product.brand} · ` : ""}{product.quantity} {product.unit}</p>
        <div className="card-price-row">{hasPrice ? <strong>{money(product.current_price as number)}</strong> : <strong>Ver precios</strong>}</div>
        <div className="card-footer"><span>{hasPrice ? "Comparación disponible" : "Historial disponible"}</span><span>→</span></div>
      </div>
    </Link>
  );
}
