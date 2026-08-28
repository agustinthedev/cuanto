import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CategoryIcon } from "../components/CategoryIcon";
import { ProductCard } from "../components/ProductCard";
import { ProductRail } from "../components/ProductRail";
import { StoreLogo } from "../components/StoreLogo";
import { StateMessage } from "../components/StateMessage";
import { isSupabaseConfigured } from "../lib/supabase";
import { getCategories, getHomepageProducts, getHomepageStats } from "../services/data";
import type { Category, HomepageStats, Product } from "../services/types";

const initialStats: HomepageStats = { products: 0, stores: 0, observations: 0, days: 0 };

function number(value: number) {
  return new Intl.NumberFormat("es-UY").format(value);
}

function money(value: number) {
  return new Intl.NumberFormat("es-UY", {
    style: "currency",
    currency: "UYU",
    maximumFractionDigits: 0,
  }).format(value);
}

export function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stats, setStats] = useState<HomepageStats>(initialStats);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getCategories(), getHomepageStats()])
      .then(([nextCategories, nextStats]) => {
        if (cancelled) return;
        setCategories(nextCategories);
        setStats(nextStats);
      })
      .catch(() => !cancelled && setError("No pudimos cargar las categorías todavía."));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const timer = window.setTimeout(() => {
      getHomepageProducts({ search, categoryId })
        .then((nextProducts) => !cancelled && setProducts(nextProducts))
        .catch(() => !cancelled && setError("No pudimos cargar los productos."))
        .finally(() => !cancelled && setLoading(false));
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search, categoryId]);

  const leadProduct = products[0];
  return (
    <section className="consumer-home container">
      <div className="consumer-search-row">
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscá productos"
            aria-label="Buscar productos"
          />
          {search && (
            <button className="search-clear" type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
              ×
            </button>
          )}
        </div>
        <span className="search-helper">Por nombre, marca o presentación</span>
      </div>

      <div className="category-row category-scroller" aria-label="Filtrar por categoría">
        <button className={!categoryId ? "category-chip selected" : "category-chip"} onClick={() => setCategoryId("")}>
          <CategoryIcon slug="all" />
          Todo
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            className={categoryId === category.id ? "category-chip selected" : "category-chip"}
            onClick={() => setCategoryId(category.id)}
          >
            <CategoryIcon slug={category.slug} />
            {category.name}
          </button>
        ))}
      </div>

      {error && <div className="inline-alert">{error}</div>}

      <section className="discovery-section" aria-labelledby="discovery-title">
        <div className="consumer-section-heading">
          <h2 id="discovery-title">
            Joyas que encontramos <span>›</span>
          </h2>
          <span className="carousel-dots">
            <i className="active" />
            <i />
            <i />
            <i />
          </span>
        </div>
        <Link className="discovery-card" to={leadProduct ? `/productos/${leadProduct.id}` : "/#explorar"}>
          <div className="discovery-image-wrap">
            {leadProduct?.image_url ? <img src={leadProduct.image_url} alt="" /> : <span className="discovery-placeholder">$</span>}
          </div>
            <div className="discovery-copy">
              <span className="discovery-store">
                {leadProduct?.best_store ? <><StoreLogo name={leadProduct.best_store} /><span>{leadProduct.best_store}</span></> : <span>Seguimiento Kuanto</span>}
              </span>
            <span className="discovery-category">{leadProduct?.category?.name ?? "Catálogo seguido"}</span>
            <h3>{leadProduct?.name ?? "Tu próxima decisión, más clara"}</h3>
            <p>
              {leadProduct
                ? `${leadProduct.brand ? `${leadProduct.brand} · ` : ""}${leadProduct.quantity} ${leadProduct.unit}`
                : "Abrí un producto para comparar cadenas y ver su historia."}
            </p>
            <div className="discovery-price-row">
              {leadProduct?.current_price ? (
                <>
                  <strong>{money(leadProduct.current_price)}</strong>
                </>
              ) : (
                <strong>Ver comparación</strong>
              )}
            </div>
            <div className="discovery-footer">
              <span>{leadProduct ? "Mejor precio disponible" : "Explorá el catálogo"}</span>
              <span>↗</span>
            </div>
          </div>
        </Link>
      </section>

      <section id="explorar" className="catalog-section" aria-labelledby="catalog-title">
        <div className="consumer-section-heading">
          <div>
            <h2 id="catalog-title">
              Productos seguidos <span>›</span>
            </h2>
            <p>Compará hoy y mirá cómo se mueve cada precio.</p>
          </div>
          <span className="catalog-count">{number(products.length)} productos</span>
        </div>
        {loading ? (
          <ProductRail label="productos seguidos">
            {[1, 2, 3, 4].map((item) => (
              <div className="skeleton-card" key={item} />
            ))}
          </ProductRail>
        ) : products.length ? (
          <ProductRail label="productos seguidos">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </ProductRail>
        ) : (
          <StateMessage
            title={isSupabaseConfigured ? "Todavía no hay productos para mostrar" : "El catálogo está listo para empezar"}
            text={
              isSupabaseConfigured
                ? "Cuando cargues el primer producto en Supabase, va a aparecer acá."
                : "Conectá tu proyecto Supabase y agregá productos curados para empezar a registrar precios reales."
            }
          />
        )}
      </section>

      <section id="como-funciona" className="data-summary-section" aria-label="Resumen de datos">
        <div className="data-summary-heading">
          <div>
            <span className="section-kicker">La historia detrás del precio</span>
            <h2>Menos intuición. Más contexto.</h2>
          </div>
          <span className="data-summary-note">
            <span className="live-dot" />
            Actualizado diariamente
          </span>
        </div>
        <div className="data-summary-grid">
          <div>
            <span>Productos seguidos</span>
            <strong>{number(stats.products)}</strong>
          </div>
          <div>
            <span>Cadenas comparadas</span>
            <strong>{number(stats.stores)}</strong>
          </div>
          <div>
            <span>Precios registrados</span>
            <strong>{number(stats.observations)}</strong>
          </div>
          <div>
            <span>Días de historia</span>
            <strong>{number(stats.days)}</strong>
          </div>
        </div>
      </section>
    </section>
  );
}
