import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { AverageChart, PriceBarChart, StoreChart } from "../components/PriceChart";
import { StateMessage } from "../components/StateMessage";
import { getProductPageData } from "../services/data";
import type { ProductEntryNavigationState, ProductReturnNavigationState } from "../services/navigation";
import type { ProductPageData } from "../services/types";

const emptyData: ProductPageData = { product: null, latestPrices: [], averagePrices: [], storePrices: [] };

function money(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 2 }).format(value);
}

export function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
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
  const entryState = location.state as Partial<ProductEntryNavigationState> | null;
  const returnTo = typeof entryState?.returnTo === "string" ? entryState.returnTo : "/";
  const returnState: ProductReturnNavigationState | undefined = typeof entryState?.returnScrollY === "number"
    ? { restoreScrollY: entryState.returnScrollY, restorePage: entryState.returnPage ?? 0 }
    : undefined;
  const bestLatest = [...latestPrices].sort((left, right) => Number(left.price) - Number(right.price))[0] ?? null;
  const bestPrice = bestLatest ? Number(bestLatest.price) : null;

  return (
    <div className="container product-page">
      <Link className="back-link" to={returnTo} state={returnState}><span>‹</span> Volver a explorar</Link>
      <section className="product-hero-card">
        <div className="detail-image-wrap">
          {product.image_url ? <img src={product.image_url} alt={product.name} className="detail-image" /> : <div className="detail-placeholder">{product.name.slice(0, 1).toUpperCase()}</div>}
        </div>
        <div className="detail-copy">
          <div className="detail-topline"><span className="product-category">{product.category?.name ?? "Producto seguido"}</span><span className="detail-live-pill"><span className="live-dot" />Seguimiento activo</span></div>
          <h1>{product.name}</h1>
          <p className="detail-meta">{product.brand ? `${product.brand} · ` : ""}{product.quantity} {product.unit}</p>
          <div className="detail-highlight">
            <span>Mejor precio registrado hoy</span>
            <strong>{bestPrice === null ? "Sin precio todavía" : money(bestPrice)}</strong>
            {bestLatest && <small>en {bestLatest.store_name}</small>}
          </div>
        </div>
        <div className="detail-aside"><span>Última observación</span><strong>{latestPrices.length ? latestPrices[0].date : "—"}</strong><small>Precios en pesos uruguayos</small><span className="detail-aside-note">Datos comparables por cadena</span></div>
      </section>

      <section className="comparison-section">
        <div className="section-heading"><div><span className="section-kicker">Ahora</span><h2>¿Dónde conviene hoy?</h2><p className="section-subcopy">Compará el último precio válido en cada cadena.</p></div><span className="section-note">Mejor precio primero</span></div>
        {latestPrices.length ? <PriceBarChart data={latestPrices} /> : <StateMessage compact title="Todavía no hay precios comparables" text="La primera observación diaria de este producto va a aparecer acá." />}
      </section>

      <section className="chart-section">
        <div className="section-heading"><div><span className="section-kicker">Tendencia</span><h2>¿Está subiendo o bajando?</h2><p className="section-subcopy">El promedio ayuda a leer el precio de hoy con contexto.</p></div><span className="section-note">Observaciones disponibles</span></div>
        <div className="chart-card"><AverageChart data={averagePrices} /></div>
      </section>

      <section className="chart-section last-section">
        <div className="section-heading"><div><span className="section-kicker">Detalle</span><h2>La historia de cada cadena</h2><p className="section-subcopy">Mirá si la diferencia es constante o solo una oportunidad puntual.</p></div></div>
        <div className="chart-card"><StoreChart data={storePrices} /></div>
      </section>
    </div>
  );
}
