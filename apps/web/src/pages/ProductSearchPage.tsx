import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CategoryIcon } from "../components/CategoryIcon";
import { ProductCard } from "../components/ProductCard";
import { StateMessage } from "../components/StateMessage";
import { getCategories, getProductSearchProducts } from "../services/data";
import type { ProductReturnNavigationState } from "../services/navigation";
import { parseProductSort, productSortOptions, type ProductSort } from "../services/productSearch";
import type { Category, Product } from "../services/types";

const PRODUCT_PAGE_SIZE = 24;

function number(value: number) {
  return new Intl.NumberFormat("es-UY").format(value);
}

export function ProductSearchPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get("q") ?? "";
  const categoryId = searchParams.get("category") ?? "";
  const sort = parseProductSort(searchParams.get("sort"));
  const [searchInput, setSearchInput] = useState(search);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const requestKeyRef = useRef("");
  const requestInFlightRef = useRef<string | null>(null);
  const restoredScrollRef = useRef(false);
  const returnState = location.state as ProductReturnNavigationState | null;
  const queryKey = `${search}\u0000${categoryId}\u0000${sort}`;
  const restorePage = typeof returnState?.restorePage === "number" && Number.isFinite(returnState.restorePage)
    ? Math.max(0, Math.floor(returnState.restorePage))
    : 0;

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useLayoutEffect(() => {
    if (loading || restoredScrollRef.current || returnState?.restoreScrollY === undefined) return;
    restoredScrollRef.current = true;
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, returnState.restoreScrollY));
    return () => window.cancelAnimationFrame(frame);
  }, [loading, returnState?.restoreScrollY]);

  useEffect(() => {
    let cancelled = false;
    setCategoryError(null);

    getCategories()
      .then((nextCategories) => !cancelled && setCategories(nextCategories))
      .catch(() => !cancelled && setCategoryError("No pudimos cargar las categorías. Podés seguir viendo los resultados, pero los filtros no están disponibles."));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    requestKeyRef.current = queryKey;
    requestInFlightRef.current = null;
    setLoading(true);
    setLoadingMore(false);
    setProducts([]);
    setTotal(0);
    setPage(0);
    setHasMore(false);
    setProductError(null);

    const isCurrentRequest = () => !cancelled && requestKeyRef.current === queryKey;
    const loadInitialPages = async () => {
      try {
        let result = await getProductSearchProducts({ search, categoryId }, { page: 0, pageSize: PRODUCT_PAGE_SIZE, sort });
        if (!isCurrentRequest()) return;
        let loadedProducts = result.products;
        setProducts(loadedProducts);
        setTotal(result.total);
        setPage(result.page);
        setHasMore(result.hasMore);

        for (let nextPage = 1; nextPage <= restorePage && result.hasMore; nextPage += 1) {
          result = await getProductSearchProducts({ search, categoryId }, { page: nextPage, pageSize: PRODUCT_PAGE_SIZE, sort });
          if (!isCurrentRequest()) return;
          loadedProducts = [...loadedProducts, ...result.products];
          setProducts(loadedProducts);
          setTotal(result.total);
          setPage(result.page);
          setHasMore(result.hasMore);
        }
      } catch {
        if (isCurrentRequest()) setProductError("No pudimos cargar los productos.");
      } finally {
        if (isCurrentRequest()) setLoading(false);
      }
    };
    void loadInitialPages();

    return () => {
      cancelled = true;
    };
  }, [categoryId, queryKey, restorePage, search, sort]);

  const loadNextPage = useCallback(async () => {
    if (loading || loadingMore || !hasMore || requestInFlightRef.current) return;
    const requestKey = queryKey;
    const nextPage = page + 1;
    requestInFlightRef.current = requestKey;
    setProductError(null);
    setLoadingMore(true);

    try {
      const result = await getProductSearchProducts(
        { search, categoryId },
        { page: nextPage, pageSize: PRODUCT_PAGE_SIZE, sort },
      );
      if (requestKeyRef.current !== requestKey) return;
      setProducts((currentProducts) => [...currentProducts, ...result.products]);
      setTotal(result.total);
      setPage(result.page);
      setHasMore(result.hasMore);
    } catch {
      if (requestKeyRef.current === requestKey) setProductError("No pudimos cargar más productos. Intentá nuevamente.");
    } finally {
      if (requestInFlightRef.current === requestKey) {
        requestInFlightRef.current = null;
        if (requestKeyRef.current === requestKey) setLoadingMore(false);
      }
    }
  }, [categoryId, hasMore, loading, loadingMore, page, queryKey, search, sort]);

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element || loading || loadingMore || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadNextPage();
      },
      { rootMargin: "480px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loadNextPage, loading, loadingMore]);

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
        {categoryError && <p className="product-search-category-error" role="status">{categoryError}</p>}
      </div>

      <div className="product-search-results-heading">
        <div>
          <span className="section-kicker">Resultados</span>
          <h2>{resultTitle}</h2>
        </div>
        <span className="product-search-count">{loading ? "Buscando…" : `${number(total)} productos`}</span>
      </div>

      {productError && !products.length ? (
        <StateMessage title="No pudimos cargar los productos" text={productError} />
      ) : loading ? (
        <div className="product-grid product-search-grid" aria-label="Cargando resultados">
          {Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index} />)}
        </div>
      ) : products.length ? (
        <div className="product-grid product-search-grid" aria-label="Resultados de productos">
          {products.map((product) => <ProductCard key={product.id} product={product} returnPage={page} />)}
        </div>
      ) : (
        <StateMessage
          title={search ? "No encontramos ese producto" : categoryId ? "No hay productos en esta categoría" : "Todavía no hay productos para mostrar"}
          text={search ? "Probá con otro nombre o marca." : "Probá con otra categoría para seguir comparando precios."}
        />
      )}

      {productError && products.length > 0 && <p className="product-search-load-more-error" role="alert">{productError}</p>}
      {hasMore && (
        <div className="product-search-load-more">
          <button className="product-search-load-more-button" type="button" onClick={() => void loadNextPage()} disabled={loadingMore}>
            {loadingMore ? "Cargando productos…" : "Cargar más productos"}
          </button>
          <div ref={loadMoreRef} className="product-search-load-more-sentinel" aria-hidden="true" />
        </div>
      )}
    </section>
  );
}
