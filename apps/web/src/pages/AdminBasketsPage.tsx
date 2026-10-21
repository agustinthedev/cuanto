import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { NormalizedProductImage } from "../components/NormalizedProductImage";
import { createBasket, getAdminBaskets, getAdminProducts, setBasketPublished } from "../services/data";
import type { AdminProduct, BasketSummary } from "../services/types";

interface BasketDraftItem {
  product_id: string;
  quantity: number;
}

function slugPreview(name: string) {
  return name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "nombre-de-la-canasta";
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-UY", { dateStyle: "medium" }).format(new Date(value));
}

function CreationModal({ products, onClose, onCreated }: { products: AdminProduct[]; onClose: () => void; onCreated: (basket: Pick<BasketSummary, "id" | "name" | "slug">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<BasketDraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const selectedIds = useMemo(() => new Set(items.map((item) => item.product_id)), [items]);
  const normalizedSearch = search.trim().toLocaleLowerCase("es-UY");
  const filteredProducts = products.filter((product) => !normalizedSearch || `${product.name} ${product.brand ?? ""} ${product.category?.name ?? ""}`.toLocaleLowerCase("es-UY").includes(normalizedSearch));

  function addProduct(productId: string) {
    setItems((current) => current.some((item) => item.product_id === productId) ? current : [...current, { product_id: productId, quantity: 1 }]);
  }

  function updateQuantity(productId: string, nextQuantity: number) {
    setItems((current) => current.map((item) => item.product_id === productId ? { ...item, quantity: Math.min(99, Math.max(1, nextQuantity || 1)) } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError(null);
    if (items.length < 2) {
      setError("Agregá al menos dos productos para crear una canasta.");
      return;
    }
    if (items.length > 50) {
      setError("Una canasta puede tener hasta 50 productos distintos.");
      return;
    }
    setSaving(true);
    try {
      const basket = await createBasket(name.trim(), items);
      await onCreated(basket);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos crear la canasta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section className="admin-modal basket-create-modal" role="dialog" aria-modal="true" aria-labelledby="basket-create-title">
        <div className="admin-modal-header">
          <div><span className="section-kicker">Nueva canasta</span><h2 id="basket-create-title">Agrupá productos para comparar</h2><p>Elegí los productos y cuántos de cada uno querés incluir. Al guardar, queda publicada.</p></div>
          <button className="modal-close" type="button" onClick={onClose} disabled={saving} aria-label="Cerrar">×</button>
        </div>
        <form onSubmit={(event) => void submit(event)}>
          <label className="basket-name-field">Nombre de la canasta<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={120} placeholder="Ej.: Compra semanal" required disabled={saving} /></label>
          <p className="basket-slug-preview">quanto.uy/canasta/{slugPreview(name)} <span>El nombre define el enlace; si está ocupado, se agrega un número.</span></p>
          <label className="basket-product-search">Buscar productos<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, marca o categoría" disabled={saving} /></label>
          <div className="basket-picker-list" aria-label="Productos del catálogo">
            {filteredProducts.slice(0, 80).map((product) => {
              const selected = selectedIds.has(product.id);
              return <div className="basket-picker-row" key={product.id}>
                <span className="basket-picker-avatar">{product.image_url ? <NormalizedProductImage src={product.image_url} /> : product.name.slice(0, 1).toUpperCase()}</span>
                <span className="basket-picker-copy"><strong>{product.name}</strong><small>{product.brand || product.category?.name || "Producto"}</small></span>
                <button className={`basket-picker-add${selected ? " is-selected" : ""}`} type="button" onClick={() => addProduct(product.id)} disabled={selected || saving || items.length >= 50}>{selected ? "Agregado" : items.length >= 50 ? "Tope alcanzado" : "Agregar"}</button>
              </div>;
            })}
            {!filteredProducts.length && <p className="basket-picker-empty">No encontramos productos para esa búsqueda.</p>}
          </div>
          {filteredProducts.length > 80 && <p className="basket-picker-empty">Mostramos las primeras 80 coincidencias. Filtrá por nombre para encontrar otro producto.</p>}
          <div className="basket-selected-section">
            <div className="basket-selected-heading"><strong>En la canasta</strong><span>{items.length} / 50 productos</span></div>
            {items.length ? <div className="basket-selected-list">{items.map((item) => {
              const product = products.find((entry) => entry.id === item.product_id);
              if (!product) return null;
              return <div className="basket-selected-row" key={item.product_id}>
                <span>{product.name}</span>
                <label>Cantidad<input type="number" min={1} max={99} step={1} value={item.quantity} onChange={(event) => updateQuantity(item.product_id, Number(event.target.value))} disabled={saving} /></label>
                <button type="button" onClick={() => setItems((current) => current.filter((entry) => entry.product_id !== item.product_id))} disabled={saving} aria-label={`Quitar ${product.name}`}>Quitar</button>
              </div>;
            })}</div> : <p className="basket-picker-empty">Sumá al menos dos productos. Podés repetir la cantidad de cada uno.</p>}
          </div>
          {error && <div className="inline-alert" role="alert">{error}</div>}
          <div className="admin-form-actions basket-create-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || name.trim().length === 0 || items.length < 2}>{saving ? "Publicando..." : "Crear y publicar"}</button></div>
        </form>
      </section>
    </div>
  );
}

function BasketAdminCard({ basket, onPublishedChange }: { basket: BasketSummary; onPublishedChange: (id: string, isPublished: boolean) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function togglePublished() {
    setBusy(true);
    setError("");
    try {
      await onPublishedChange(basket.id, !basket.is_published);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos actualizar la publicación.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="basket-admin-card">
      <div className="basket-admin-card-copy"><span className={`basket-admin-status${basket.is_published ? " is-published" : ""}`}>{basket.is_published ? "Publicada" : "Oculta"}</span><h3>{basket.name}</h3><p>{basket.item_count} productos · Creada {dateLabel(basket.created_at)}</p><code>/canasta/{basket.slug}</code></div>
      <div className="basket-admin-card-actions"><button className="button button-secondary" type="button" onClick={() => void togglePublished()} disabled={busy}>{busy ? "Guardando..." : basket.is_published ? "Ocultar" : "Publicar"}</button>{basket.is_published && <Link className="button button-primary" to={`/canasta/${basket.slug}`}>Ver página <span aria-hidden="true">↗</span></Link>}</div>
      {error && <p className="basket-admin-error" role="alert">{error}</p>}
    </article>
  );
}

export function AdminBasketsPage() {
  const [baskets, setBaskets] = useState<BasketSummary[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [success, setSuccess] = useState<Pick<BasketSummary, "name" | "slug"> | null>(null);

  async function loadData() {
    setError("");
    try {
      const [nextBaskets, nextProducts] = await Promise.all([getAdminBaskets(), getAdminProducts()]);
      setBaskets(nextBaskets);
      setProducts(nextProducts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos cargar las canastas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadData(); }, []);

  async function handlePublishedChange(id: string, isPublished: boolean) {
    await setBasketPublished(id, isPublished);
    await loadData();
  }

  const normalizedSearch = search.trim().toLocaleLowerCase("es-UY");
  const filtered = baskets.filter((basket) => !normalizedSearch || `${basket.name} ${basket.slug}`.toLocaleLowerCase("es-UY").includes(normalizedSearch));

  return (
    <div className="container admin-page admin-baskets-page">
      <div className="admin-page-header"><div><span className="section-kicker">Admin / Canastas</span><h1>Canastas</h1><p>Publicá combinaciones de productos y compará el costo de una compra completa.</p></div><button className="button button-primary admin-page-header-action" type="button" onClick={() => setShowModal(true)}>Crear canasta <span>＋</span></button></div>
      {success && <div className="inline-alert inline-alert-success basket-created-alert" role="status">“{success.name}” ya está publicada. <Link to={`/canasta/${success.slug}`}>Abrir página ↗</Link></div>}
      {error && <div className="inline-alert" role="alert">{error}</div>}
      <div className="admin-products-search"><label htmlFor="admin-baskets-search-input">Buscar canastas</label><div className="admin-products-search-control"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg><input id="admin-baskets-search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre o URL" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">×</button>}</div><p className="admin-products-search-count">{filtered.length} de {baskets.length} canastas</p></div>
      <section className="admin-baskets-section"><div className="admin-card-heading"><div><span className="section-kicker">Catálogo de canastas</span><h2>Canastas creadas</h2></div><span className="section-note">Las canastas ocultas siguen guardadas</span></div>
        {loading ? <div className="admin-loading"><div className="loading-orb" /><p>Cargando canastas...</p></div> : filtered.length ? <div className="basket-admin-list">{filtered.map((basket) => <BasketAdminCard key={basket.id} basket={basket} onPublishedChange={handlePublishedChange} />)}</div> : <div className="state-message"><div className="state-icon">◌</div><div><h3>{baskets.length ? "No encontramos canastas" : "Todavía no hay canastas"}</h3><p>{baskets.length ? "Probá con otro nombre o slug." : "Creá la primera canasta y se podrá compartir en una página pública."}</p></div></div>}
      </section>
      {showModal && <CreationModal products={products} onClose={() => setShowModal(false)} onCreated={async (basket) => { await loadData(); setShowModal(false); setSuccess(basket); }} />}
    </div>
  );
}
