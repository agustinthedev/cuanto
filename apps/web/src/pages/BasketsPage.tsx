import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { StateMessage } from "../components/StateMessage";
import { getPublicBaskets } from "../services/data";
import type { BasketPublicListing } from "../services/types";

function money(value: number) {
  return new Intl.NumberFormat("es-UY", { style: "currency", currency: "UYU", maximumFractionDigits: 2 }).format(value);
}

export function BasketsPage() {
  const [baskets, setBaskets] = useState<BasketPublicListing[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "price">("recent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicBaskets()
      .then((items) => { if (!cancelled) setBaskets(items); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visibleBaskets = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase("es-UY");
    return baskets.filter((basket) => !normalizedSearch || `${basket.name} ${basket.slug}`.toLocaleLowerCase("es-UY").includes(normalizedSearch))
      .sort((left, right) => sort === "price"
        ? (left.best_price ?? Number.POSITIVE_INFINITY) - (right.best_price ?? Number.POSITIVE_INFINITY) || right.created_at.localeCompare(left.created_at)
        : right.created_at.localeCompare(left.created_at));
  }, [baskets, search, sort]);

  return (
    <div className="container baskets-directory-page">
      <section className="baskets-directory-hero"><span className="section-kicker">Compras completas</span><h1>Canastas para comparar</h1><p>Explorá combinaciones de productos y encontrá dónde conviene comprar cada compra.</p></section>
      <div className="baskets-directory-controls"><label htmlFor="basket-directory-search">Buscar canastas<input id="basket-directory-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ej.: compra semanal" /></label><label htmlFor="basket-directory-sort">Ordenar por<select id="basket-directory-sort" value={sort} onChange={(event) => setSort(event.target.value as "recent" | "price")}><option value="recent">Más recientes</option><option value="price">Menor precio disponible</option></select></label></div>
      {error ? <StateMessage title="No pudimos cargar las canastas" text="Revisá la conexión o volvé a intentarlo en unos segundos." />
        : loading ? <div className="page-loading"><div className="loading-orb" /><p>Cargando canastas...</p></div>
          : visibleBaskets.length ? <div className="basket-directory-grid">{visibleBaskets.map((basket) => <Link className="basket-directory-card" key={basket.id} to={`/canasta/${basket.slug}`}>
            <div className="basket-directory-icon" aria-hidden="true"><span>▦</span><i>＋</i></div>
            <div className="basket-directory-card-copy"><span className="basket-directory-items">{basket.item_count} productos</span><h2>{basket.name}</h2><p>{basket.best_price === null ? "Esperando precios completos" : `Desde ${money(basket.best_price)} en ${basket.best_store}`}</p></div>
            <span className="basket-directory-arrow" aria-hidden="true">↗</span>
          </Link>)}</div>
          : <StateMessage title={baskets.length ? "No encontramos canastas" : "Todavía no hay canastas publicadas"} text={baskets.length ? "Probá con otra búsqueda." : "Cuando se publiquen canastas, vas a poder comparar el total de una compra acá."} />}
    </div>
  );
}
