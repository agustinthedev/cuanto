import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { StateMessage } from "../components/StateMessage";
import { isSupabaseConfigured } from "../lib/supabase";
import { getCategories, getHomepageProducts, getHomepageStats } from "../services/data";
import type { Category, HomepageStats, Product } from "../services/types";

const initialStats: HomepageStats = { products: 0, stores: 0, observations: 0, days: 0 };

function number(value: number) {
  return new Intl.NumberFormat("es-UY").format(value);
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
    return () => { cancelled = true; };
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
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search, categoryId]);

  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <div className="eyebrow"><span className="eyebrow-star">✦</span> El radar de precios de Uruguay</div>
          <h1>Comprá con más información.<br /><em>Pagá lo justo.</em></h1>
          <p className="hero-lead">Compará precios de supermercados en Uruguay y seguí cómo cambian con el tiempo. Datos simples para decisiones cotidianas.</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#explorar">Explorar productos <span>↓</span></a>
            <Link className="text-link" to="/">Ver lo último <span>↗</span></Link>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-core"><span>$</span><small>UYU</small></div>
          <div className="float-card float-card-one"><span className="mini-dot mint" />Precio de hoy <strong>$ 129</strong></div>
          <div className="float-card float-card-two"><span className="mini-dot lilac" />Seguimiento diario <strong>+ 3 cadenas</strong></div>
        </div>
      </section>

      <section className="stats-strip container" aria-label="Estadísticas de Cuánto.uy">
        <div><strong>{number(stats.products)}</strong><span>productos seguidos</span></div>
        <div><strong>{number(stats.stores)}</strong><span>cadenas comparadas</span></div>
        <div><strong>{number(stats.observations)}</strong><span>precios registrados</span></div>
        <div><strong>{number(stats.days)}</strong><span>días de historia</span></div>
      </section>

      <section id="explorar" className="explore-section container">
        <div className="section-heading">
          <div><span className="section-kicker">Explorá el catálogo</span><h2>¿Qué estás buscando?</h2></div>
          <span className="section-note">Actualizado con cada registro diario</span>
        </div>
        <div className="search-box">
          <span className="search-icon">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscá por nombre, marca o producto..." aria-label="Buscar productos" />
          <kbd>⌘ K</kbd>
        </div>
        <div className="category-row" aria-label="Filtrar por categoría">
          <button className={!categoryId ? "category-chip selected" : "category-chip"} onClick={() => setCategoryId("")}>Todo</button>
          {categories.map((category) => <button key={category.id} className={categoryId === category.id ? "category-chip selected" : "category-chip"} onClick={() => setCategoryId(category.id)}>{category.name}</button>)}
        </div>

        {error && <div className="inline-alert">{error}</div>}
        {loading ? <div className="skeleton-grid">{[1, 2, 3, 4].map((item) => <div className="skeleton-card" key={item} />)}</div> : products.length ? (
          <div className="product-grid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        ) : (
          <StateMessage
            title={isSupabaseConfigured ? "Todavía no hay productos para mostrar" : "El catálogo está listo para empezar"}
            text={isSupabaseConfigured ? "Cuando cargues el primer producto en Supabase, va a aparecer acá." : "Conectá tu proyecto Supabase y agregá productos curados para empezar a registrar precios reales."}
          />
        )}
      </section>

      <section id="como-funciona" className="how-section container">
        <div className="section-heading"><div><span className="section-kicker">La idea</span><h2>Precios que cuentan una historia.</h2></div></div>
        <div className="how-grid">
          <div className="how-card"><span>01</span><h3>Miramos el precio de hoy</h3><p>Seguimos productos curados en cada cadena para que la comparación sea clara y confiable.</p></div>
          <div className="how-card featured-how"><span>02</span><h3>Guardamos cada día</h3><p>Una foto diaria permite ver cambios reales, no solo el número de una góndola.</p></div>
          <div className="how-card"><span>03</span><h3>Te damos contexto</h3><p>Compará cadenas y mirá el promedio histórico antes de decidir dónde comprar.</p></div>
        </div>
      </section>
    </>
  );
}
