import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AverageChart, StoreChart } from "../components/PriceChart";
import { StateMessage } from "../components/StateMessage";
import { getProductPageData } from "../services/data";
import type { ProductPageData } from "../services/types";

const emptyData: ProductPageData = { product: null, latestPrices: [], averagePrices: [], storePrices: [] };

function money(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 2 }).format(value);
}

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<ProductPageData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getProductPageData(id)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="container page-loading"><div className="loading-orb" /><p>Cargando el historial...</p></div>;
  if (error) return <div className="container page-state"><StateMessage title="No pudimos cargar este producto" text="Revisá la conexión o volvé a intentarlo en unos segundos." /></div>;
  if (!data.product) return <div className="container page-state"><StateMessage title="Producto no encontrado" text="Este producto todavía no forma parte del catálogo seguido." /></div>;

  const { product, latestPrices, averagePrices, storePrices } = data;
  return (
    <div className="container product-page">
      <Link className="back-link" to="/">← Volver a explorar</Link>
      <section className="product-hero-card">
        <div className="detail-image-wrap">
          {product.image_url ? <img src={product.image_url} alt={product.name} className="detail-image" /> : <div className="detail-placeholder">{product.name.slice(0, 1).toUpperCase()}</div>}
        </div>
        <div className="detail-copy">
          <span className="product-category">{product.category?.name ?? "Producto seguido"}</span>
          <h1>{product.name}</h1>
          <p className="detail-meta">{product.brand ? `${product.brand} · ` : ""}{product.quantity} {product.unit}</p>
          <div className="detail-badge"><span className="live-dot" /> Seguimiento diario activo</div>
        </div>
        <div className="detail-aside"><span>Última observación</span><strong>{latestPrices.length ? latestPrices[0].date : "—"}</strong><small>Precios en pesos uruguayos</small></div>
      </section>

      <section className="comparison-section">
        <div className="section-heading"><div><span className="section-kicker">Ahora</span><h2>¿Dónde conviene hoy?</h2></div><span className="section-note">Último precio válido por cadena</span></div>
        {latestPrices.length ? <div className="price-comparison-grid">{latestPrices.map((item) => <a href={item.url} target="_blank" rel="noreferrer" className="price-card" key={item.store_product_id}><span className="price-store"><span className={`store-avatar store-${item.store_slug}`}>{item.store_name.slice(0, 1)}</span>{item.store_name}</span><strong>{money(Number(item.price))}</strong><span className="price-date">Ver en la tienda ↗</span></a>)}</div> : <StateMessage compact title="Todavía no hay precios comparables" text="La primera observación diaria de este producto va a aparecer acá." />}
      </section>

      <section className="chart-section">
        <div className="section-heading"><div><span className="section-kicker">Tendencia</span><h2>Promedio entre supermercados</h2></div><span className="section-note">Solo promedia observaciones disponibles</span></div>
        <div className="chart-card"><AverageChart data={averagePrices} /></div>
      </section>

      <section className="chart-section last-section">
        <div className="section-heading"><div><span className="section-kicker">Detalle</span><h2>La historia de cada cadena</h2></div></div>
        <div className="chart-card"><StoreChart data={storePrices} /></div>
      </section>
    </div>
  );
}
