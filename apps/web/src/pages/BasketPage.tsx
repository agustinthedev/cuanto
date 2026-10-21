import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { AverageChart, StoreChart } from "../components/PriceChart";
import { NormalizedProductImage } from "../components/NormalizedProductImage";
import { StateMessage } from "../components/StateMessage";
import { getBasketPageData } from "../services/data";
import type { BasketItem, BasketPageData, LatestPrice } from "../services/types";

const emptyData: BasketPageData = { basket: null, items: [], basketPrices: [], componentPrices: [], averagePrices: [], storePrices: [] };

function money(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 2 }).format(value);
}

function dateLabel(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-UY", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`));
}

function unitPrice(price: number, item: BasketItem) {
  const { quantity, unit } = item.product;
  const baseQuantity = unit === "g" || unit === "ml" ? quantity / 1000 : quantity;
  if (!baseQuantity) return null;
  const unitLabel = unit === "g" ? "kg" : unit === "ml" ? "L" : unit;
  return { price: price / baseQuantity, unitLabel };
}

function componentPriceRows(item: BasketItem, prices: LatestPrice[]) {
  const byStore = new Map<string, LatestPrice[]>();
  prices.filter((price) => price.product_id === item.product_id).forEach((price) => {
    const rows = byStore.get(price.store_id) ?? [];
    rows.push(price);
    byStore.set(price.store_id, rows);
  });
  return [...byStore.values()].map((rows) => ({
    ...rows[0],
    price: rows.reduce((total, row) => total + Number(row.price), 0) / rows.length,
  })).sort((left, right) => Number(left.price) - Number(right.price));
}

function BasketProduct({ item, prices }: { item: BasketItem; prices: LatestPrice[] }) {
  const rows = componentPriceRows(item, prices);
  const best = rows[0] ?? null;
  const average = rows.length ? rows.reduce((total, row) => total + Number(row.price), 0) / rows.length : null;
  const normalized = best ? unitPrice(Number(best.price), item) : null;
  const quantityLabel = new Intl.NumberFormat("es-UY", { maximumFractionDigits: 3 }).format(item.product.quantity);

  return (
    <article className="basket-product-card">
      <Link className="basket-product-image" to={`/productos/${item.product.id}`} aria-label={`Ver ${item.product.name}`}>
        {item.product.image_url ? <NormalizedProductImage src={item.product.image_url} /> : <span>{item.product.name.slice(0, 1).toUpperCase()}</span>}
      </Link>
      <div className="basket-product-copy">
        <span className="basket-product-category">{item.product.category?.name ?? "Producto"}</span>
        <h3><Link to={`/productos/${item.product.id}`}>{item.product.name}</Link></h3>
        <p>{item.quantity > 1 ? `${item.quantity} × ` : ""}{quantityLabel} {item.product.unit}{item.product.brand ? ` · ${item.product.brand}` : ""}</p>
      </div>
      <div className="basket-product-prices">
        <span>Mejor precio reciente</span>
        <strong>{best ? money(Number(best.price)) : "—"}</strong>
        <small>{best ? `en ${best.store_name} · subtotal: ${money(Number(best.price) * item.quantity)}` : "Sin precio reciente"}</small>
      </div>
      <div className="basket-product-prices basket-product-unit-price">
        <span>Promedio entre cadenas</span>
        <strong>{average === null ? "—" : money(average)}</strong>
        <small>{normalized ? `${money(normalized.price)} / ${normalized.unitLabel}` : `${rows.length} cadenas con dato`}</small>
      </div>
    </article>
  );
}

function CurrentBasketComparison({ prices }: { prices: LatestPrice[] }) {
  const sorted = [...prices].sort((left, right) => Number(left.price) - Number(right.price));
  if (!sorted.length) return <StateMessage compact title="Todavía no hay un total comparable" text="El total aparece cuando una cadena tiene precio reciente para todos los productos de la canasta." />;
  const maxPrice = Number(sorted[sorted.length - 1].price);
  const lowestPrice = Number(sorted[0].price);

  return (
    <div className="basket-store-list" role="list" aria-label="Total reciente de la canasta por cadena">
      {sorted.map((row, index) => {
        const price = Number(row.price);
        const extraCost = price - lowestPrice;
        const width = maxPrice > 0 ? Math.max(12, price / maxPrice * 100) : 0;
        return (
          <div className={`basket-store-row${index === 0 ? " is-best" : ""}`} key={row.store_id} role="listitem">
            <div className="basket-store-row-heading"><span><i className={`basket-store-dot store-${row.store_slug}`} />{row.store_name}</span><small>{index === 0 ? "Menor total" : extraCost > 0 ? `${money(extraCost)} más` : ""}</small></div>
            <div className="basket-store-track" aria-hidden="true"><i style={{ width: `${width}%` }} /></div>
            <div className="basket-store-row-footer"><strong>{money(price)}</strong><small>Todos los productos · {dateLabel(row.date)}</small></div>
          </div>
        );
      })}
    </div>
  );
}

export function BasketPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const [data, setData] = useState<BasketPageData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getBasketPageData(slug)
      .then((nextData) => { if (!cancelled) setData(nextData); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const currentStats = useMemo(() => {
    const prices = data.basketPrices.map((row) => Number(row.price));
    if (!prices.length) return null;
    const best = Math.min(...prices);
    const highest = Math.max(...prices);
    return {
      best,
      average: prices.reduce((sum, price) => sum + price, 0) / prices.length,
      savings: highest - best,
      savingsPercentage: highest ? (highest - best) / highest * 100 : 0,
      bestStore: data.basketPrices.find((row) => Number(row.price) === best)?.store_name ?? "",
    };
  }, [data.basketPrices]);

  if (loading) return <div className="container page-loading"><div className="loading-orb" /><p>Cargando precios de la canasta...</p></div>;
  if (error) return <div className="container page-state"><StateMessage title="No pudimos cargar esta canasta" text="Revisá la conexión o volvé a intentarlo en unos segundos." /></div>;
  if (!data.basket) return <div className="container page-state"><StateMessage title="Canasta no encontrada" text="Esta canasta no existe o ya no está publicada." /></div>;

  const lastObservation = data.basketPrices.reduce((latest, item) => item.date < latest || !latest ? item.date : latest, "");
  const shareUrl = typeof window === "undefined" ? "" : window.location.href;

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareMessage("Enlace copiado");
    } catch {
      setShareMessage("Copiá el enlace desde la barra del navegador");
    }
  }

  return (
    <div className="container basket-page">
      <Link className="back-link" to="/canastas"><span>‹</span> Ver todas las canastas</Link>
      <section className="basket-hero">
        <div className="basket-hero-copy">
          <div className="basket-hero-topline"><span className="section-kicker">Canasta pública</span><span className="basket-live-pill"><i />Comparación activa</span></div>
          <h1>{data.basket.name}</h1>
          <p>{data.items.length} productos para comparar en una sola compra. Los totales incluyen solo cadenas con precio reciente para todos los productos.</p>
          <div className="basket-share-row"><button className="button button-secondary" type="button" onClick={() => void copyShareLink()}>Compartir canasta <span aria-hidden="true">↗</span></button>{shareMessage && <span role="status">{shareMessage}</span>}</div>
        </div>
        <div className="basket-hero-aside"><span>Actualizada con datos hasta</span><strong>{dateLabel(lastObservation)}</strong><small>Precios en pesos uruguayos</small></div>
      </section>

      <section className="basket-summary-grid" aria-label="Resumen de precios de la canasta">
        <div className="basket-summary-card basket-summary-best"><span>Menor total reciente</span><strong>{currentStats ? money(currentStats.best) : "—"}</strong><small>{currentStats ? `en ${currentStats.bestStore}` : "Esperando precios completos"}</small></div>
        <div className="basket-summary-card"><span>Promedio entre cadenas</span><strong>{currentStats ? money(currentStats.average) : "—"}</strong><small>{data.basketPrices.length} cadenas comparables</small></div>
        <div className="basket-summary-card"><span>Ahorro entre cadenas</span><strong>{currentStats ? money(currentStats.savings) : "—"}</strong><small>{currentStats ? `${currentStats.savingsPercentage.toFixed(1).replace(".", ",")}% menos que el total mayor` : "Cuando haya más de un total"}</small></div>
      </section>

      <section className="basket-section">
        <div className="section-heading"><div><span className="section-kicker">Comparación de hoy</span><h2>¿Dónde conviene comprarla?</h2><p className="section-subcopy">El total suma las cantidades elegidas para cada producto.</p></div><span className="section-note">Solo canastas completas</span></div>
        <CurrentBasketComparison prices={data.basketPrices} />
      </section>

      <section className="basket-section">
        <div className="section-heading"><div><span className="section-kicker">Tendencia</span><h2>El promedio de la canasta</h2><p className="section-subcopy">Promedio diario de los totales completos disponibles entre cadenas.</p></div><span className="section-note">Por día observado</span></div>
        <div className="chart-card"><AverageChart data={data.averagePrices} /></div>
      </section>

      <section className="basket-section">
        <div className="section-heading"><div><span className="section-kicker">Historial</span><h2>Precio por cadena</h2><p className="section-subcopy">Seguí cómo cambia el total de la misma canasta en cada supermercado.</p></div></div>
        <div className="chart-card"><StoreChart data={data.storePrices} /></div>
      </section>

      <section className="basket-section basket-components-section">
        <div className="section-heading"><div><span className="section-kicker">Contenido</span><h2>Productos de la canasta</h2><p className="section-subcopy">Los precios individuales ayudan a entender qué pesa más en el total.</p></div><span className="section-note">{data.items.length} productos</span></div>
        <div className="basket-products-list">{data.items.map((item) => <BasketProduct key={item.id} item={item} prices={data.componentPrices} />)}</div>
      </section>
    </div>
  );
}
