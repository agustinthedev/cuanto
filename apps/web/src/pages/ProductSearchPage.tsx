import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CategoryIcon } from "../components/CategoryIcon";
import { ProductCard } from "../components/ProductCard";
import { StateMessage } from "../components/StateMessage";
import { getCategories, getProductSearchProducts } from "../services/data";
import { parseProductSort, productSortOptions, sortProducts, type ProductSort } from "../services/productSearch";
import type { Category, Product } from "../services/types";

function number(value: number) {
  return new Intl.NumberFormat("es-UY").format(value);
}

export function ProductSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("category") ?? "";
  const sort = parseProductSort(searchParams.get("sort"));
  const [searchInput, setSearchInput] = useState(search);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    let cancelled = false;

    getCategories()
      .then((nextCategories) => !cancelled && setCategories(nextCategories))
      .catch(() => !cancelled && setError("No pudimos cargar las categorías."));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getProductSearchProducts({ search, categoryId })
      .then((nextProducts) => !cancelled && setProducts(nextProducts))
      .catch(() => !cancelled && setError("No pudimos cargar los productos."))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [categoryId, search]);

  const updateParams = (updates: { search?: string; categoryId?: string; sort?: ProductSort }) => {
    const nextParams = new URLSearchParams(searchParams);
    if (updates.search !== undefined) {
      if (updates.search.trim()) nextParams.set("q", updates.search.trim());
      else nextParams.delete("q");
    }
    if (updates.categoryId !== undefined) {
      if (updates.categoryId) nextParams.set("category", updates.categoryId);
      else nextParams.delete("category");
    }
    if (updates.sort !== undefined) {
      if (updates.sort === "relevance") nextParams.delete("sort");
      else nextParams.set("sort", updates.sort);
    }
    setSearchParams(nextParams, { replace: true });
  };

  const sortedProducts = sortProducts(products, sort);
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const hasFilters = Boolean(search || categoryId || sort !== "relevance");
  const resultTitle = search
    ? `Resultados para “${search}”`
    : selectedCategory
      ? `Productos de ${selectedCategory.name}`
      : "Todos los productos";

  return (
    <section className="product-search-page container">
      <Link className="back-link product-search-back-link" to="/"><span>‹</span> Volver a explorar</Link>

      <div className="product-search-intro">
        <span className="section-kicker">Catálogo</span>
        <h1>Productos</h1>
        <p>Buscá, filtrá y ordená los precios del catálogo seguido.</p>
      </div>

      <form className="product-search-form" onSubmit={(event) => { event.preventDefault(); updateParams({ search: searchInput }); }}>
        <span className="search-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 5 5" /></svg>
        </span>
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Buscá por nombre o marca"
          aria-label="Buscar productos por nombre o marca"
        />
        {searchInput && (
          <button className="search-clear" type="button" onClick={() => { setSearchInput(""); updateParams({ search: "" }); }} aria-label="Limpiar búsqueda">
            ×
          </button>
        )}
        <button className="product-search-submit" type="submit">Buscar <span aria-hidden="true">→</span></button>
      </form>

      <div className="product-search-filters">
        <div className="product-search-filter-heading">
          <span>Filtrar por categoría</span>
          {hasFilters && <button className="product-search-clear-filters" type="button" onClick={() => { setSearchInput(""); updateParams({ search: "", categoryId: "", sort: "relevance" }); }}>Limpiar filtros</button>}
        </div>
        <div className="category-row category-scroller product-search-category-row" aria-label="Filtrar por categoría">
          <button type="button" className={!categoryId ? "category-chip selected" : "category-chip"} onClick={() => updateParams({ categoryId: "" })}>
            <CategoryIcon slug="all" />
            Todo
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={categoryId === category.id ? "category-chip selected" : "category-chip"}
              onClick={() => updateParams({ categoryId: category.id })}
            >
              <CategoryIcon slug={category.slug} />
              {category.name}
            </button>
          ))}
        </div>

        <div className="product-search-sort-row">
          <label className="product-search-sort-control">
            <span>Ordenar por</span>
            <span className="product-search-select-wrap">
              <select value={sort} onChange={(event) => updateParams({ sort: event.target.value as ProductSort })}>
                {productSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <span className="product-search-select-arrow" aria-hidden="true">⌄</span>
            </span>
          </label>
        </div>
      </div>

      <div className="product-search-results-heading">
        <div>
          <span className="section-kicker">Resultados</span>
          <h2>{resultTitle}</h2>
        </div>
        <span className="product-search-count">{loading ? "Buscando…" : `${number(sortedProducts.length)} productos`}</span>
      </div>

      {error ? (
        <StateMessage title="No pudimos cargar los productos" text={error} />
      ) : loading ? (
        <div className="product-grid product-search-grid" aria-label="Cargando resultados">
          {Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index} />)}
        </div>
      ) : sortedProducts.length ? (
        <div className="product-grid product-search-grid" aria-label="Resultados de productos">
          {sortedProducts.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <StateMessage
          title={search ? "No encontramos ese producto" : categoryId ? "No hay productos en esta categoría" : "Todavía no hay productos para mostrar"}
          text={search ? "Probá con otro nombre o marca." : "Probá con otra categoría para seguir comparando precios."}
        />
      )}
    </section>
  );
}
