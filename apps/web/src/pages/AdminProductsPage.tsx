import { useEffect, useState, type FormEvent } from "react";
import { NormalizedProductImage } from "../components/NormalizedProductImage";
import { ProductTagSelector } from "../components/ProductTagSelector";
import { StoreLogo } from "../components/StoreLogo";
import { MeasurementFields, StoreLinkFields, type LinkDraft } from "./ProductSuggestionsPage";
import { isHttpUrl, productLinksError, serializeProductLinks } from "./adminProductLinks";
import { createTag, getAdminStores, getAdminProducts, getCategories, getTags, updateProduct } from "../services/data";
import { parseProductQuantity, productMeasurementError, type ProductUnit } from "../services/productMeasurement";
import type { AdminProduct, Category, Store, Tag } from "../services/types";
import { matchesAdminProductSearch } from "./adminProductSearch";

function initialLinks(product: AdminProduct, stores: Store[]): LinkDraft[] {
  return stores.map((store) => ({
    storeId: store.id,
    url: product.links.find((link) => link.store_id === store.id)?.url ?? "",
  }));
}

function formatQuantity(quantity: number) {
  return new Intl.NumberFormat("es-UY", { maximumFractionDigits: 3 }).format(quantity);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-UY", { dateStyle: "medium" }).format(new Date(value));
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m15.2 5.2 3.6 3.6M5 19l3.2-.7L19.7 6.8a1.9 1.9 0 0 0-2.7-2.7L5.5 15.6 5 19Z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={open ? "is-open" : ""} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m7 9 5 5 5-5" />
    </svg>
  );
}

function ReadonlyTags({ tags }: { tags: Tag[] }) {
  return (
    <div className="admin-product-readonly-section">
      <span className="admin-product-readonly-label">Tags</span>
      {tags.length ? <div className="admin-tags-list admin-product-readonly-tags">{tags.map((tag) => <span className="admin-tag-chip" key={tag.id}>{tag.name}</span>)}</div> : <p className="admin-product-empty-value">Sin tags asignados</p>}
    </div>
  );
}

function ReadonlyLinks({ product, stores }: { product: AdminProduct; stores: Store[] }) {
  return (
    <fieldset className="admin-links-fieldset admin-product-readonly-links-fieldset">
      <legend>Links por cadena</legend>
      {stores.length ? (
        <div className="admin-product-readonly-link-list">
          {stores.map((store) => {
            const link = product.links.find((item) => item.store_id === store.id);
            return (
              <div className="admin-product-readonly-link" key={store.id}>
                <span className="admin-store-label"><StoreLogo name={store.name} slug={store.slug} />{store.name}</span>
                {link?.url && isHttpUrl(link.url) ? <a href={link.url} target="_blank" rel="noreferrer noopener" title={link.url}>{link.url}<span aria-hidden="true">↗</span></a> : <span className="admin-product-empty-value">Sin link cargado</span>}
              </div>
            );
          })}
        </div>
      ) : <p className="admin-product-empty-value">No hay cadenas configuradas.</p>}
    </fieldset>
  );
}

function ReadonlyProductDetails({ product, stores }: { product: AdminProduct; stores: Store[] }) {
  return (
    <div className="admin-product-readonly">
      <div className={`admin-product-readonly-top${product.image_url ? "" : " without-image"}`}>
        {product.image_url && <div className="admin-product-image"><NormalizedProductImage src={product.image_url} /></div>}
        <div className="admin-product-readonly-grid">
          <div className="admin-product-readonly-field"><span>Nombre</span><strong>{product.name}</strong></div>
          <div className="admin-product-readonly-field"><span>Marca</span><strong>{product.brand || "Sin marca"}</strong></div>
          <div className="admin-product-readonly-field"><span>Categoría</span><strong>{product.category?.name || "Sin categoría"}</strong></div>
          <div className="admin-product-readonly-field"><span>Presentación</span><strong>{formatQuantity(product.quantity)} {product.unit}</strong></div>
          <div className="admin-product-readonly-field"><span>Agregado</span><strong>{formatDate(product.created_at)}</strong></div>
        </div>
      </div>
      <ReadonlyTags tags={product.tags} />
      <ReadonlyLinks product={product} stores={stores} />
    </div>
  );
}

function AdminProductAccordion({ product, categories, stores, tags, onCreateTag, onChanged, hidden = false }: { product: AdminProduct; categories: Category[]; stores: Store[]; tags: Tag[]; onCreateTag: (name: string) => Promise<Tag>; onChanged: () => Promise<void>; hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [brand, setBrand] = useState(product.brand ?? "");
  const [categoryId, setCategoryId] = useState(product.category?.id ?? "");
  const [quantity, setQuantity] = useState(String(product.quantity));
  const [unit, setUnit] = useState<ProductUnit>(product.unit);
  const [links, setLinks] = useState<LinkDraft[]>(() => initialLinks(product, stores));
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(() => product.tags.map((tag) => tag.id));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const panelId = `admin-product-panel-${product.id}`;

  useEffect(() => {
    if (editing) return;
    setName(product.name);
    setBrand(product.brand ?? "");
    setCategoryId(product.category?.id ?? "");
    setQuantity(String(product.quantity));
    setUnit(product.unit);
    setLinks(initialLinks(product, stores));
    setSelectedTagIds(product.tags.map((tag) => tag.id));
  }, [categories, editing, product, stores]);

  function startEditing() {
    setError(null);
    setName(product.name);
    setBrand(product.brand ?? "");
    setCategoryId(product.category?.id ?? "");
    setQuantity(String(product.quantity));
    setUnit(product.unit);
    setLinks(initialLinks(product, stores));
    setSelectedTagIds(product.tags.map((tag) => tag.id));
    setEditing(true);
  }

  function cancelEditing() {
    if (saving || creatingTag) return;
    setError(null);
    setName(product.name);
    setBrand(product.brand ?? "");
    setCategoryId(product.category?.id ?? "");
    setQuantity(String(product.quantity));
    setUnit(product.unit);
    setLinks(initialLinks(product, stores));
    setSelectedTagIds(product.tags.map((tag) => tag.id));
    setEditing(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || creatingTag) return;
    setError(null);
    if (!categoryId) {
      setError("Elegí una categoría antes de guardar.");
      return;
    }
    const parsedQuantity = parseProductQuantity(quantity);
    const measurementValidation = productMeasurementError(quantity, unit);
    if (measurementValidation || parsedQuantity === null) {
      setError(measurementValidation ?? "Ingresá una cantidad mayor o igual a 0,001.");
      return;
    }
    const linkValidation = productLinksError(links, stores);
    if (linkValidation) {
      setError(linkValidation);
      return;
    }
    setSaving(true);
    try {
      await updateProduct(product.id, name, brand, categoryId, parsedQuantity, unit, serializeProductLinks(links), selectedTagIds);
      await onChanged();
      setEditing(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className={`admin-product-item${open ? " is-open" : ""}`} hidden={hidden}>
      <div className="admin-product-summary-row">
        <button className="admin-product-summary" type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls={panelId}>
          <span className="admin-product-chevron"><ChevronIcon open={open} /></span>
          <span className="admin-product-summary-title">{product.name}</span>
        </button>
        {open && !editing && <button className="admin-product-edit-button" type="button" onClick={startEditing} aria-label={`Editar ${product.name}`} title="Editar producto"><PencilIcon /></button>}
      </div>

      {open && (
        <div className="admin-product-panel" id={panelId}>
          {error && <div className="inline-alert" role="alert">{error}</div>}
          {editing ? (
            <form onSubmit={handleSubmit}>
              <div className="admin-form-grid">
                <label>Nombre<input autoFocus value={name} onChange={(event) => setName(event.target.value)} maxLength={200} required disabled={saving || creatingTag} /></label>
                <label>Marca<input value={brand} onChange={(event) => setBrand(event.target.value)} maxLength={120} placeholder="Sin marca" disabled={saving || creatingTag} /></label>
                <label>Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required disabled={saving || creatingTag}><option value="" disabled>Seleccioná una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
                <MeasurementFields quantity={quantity} unit={unit} onQuantityChange={setQuantity} onUnitChange={setUnit} disabled={saving || creatingTag} />
              </div>
              <ProductTagSelector tags={tags} selectedTagIds={selectedTagIds} onChange={setSelectedTagIds} onCreateTag={onCreateTag} onBusyChange={setCreatingTag} disabled={saving} />
              <fieldset className="admin-links-fieldset"><legend>Links por cadena</legend><StoreLinkFields links={links} stores={stores} disabled={saving || creatingTag} onChange={(storeId, url) => setLinks((current) => current.map((link) => link.storeId === storeId ? { ...link, url } : link))} /></fieldset>
              <div className="suggestion-actions admin-product-form-actions"><button className="button button-secondary" type="button" onClick={cancelEditing} disabled={saving || creatingTag}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving || creatingTag}>{saving ? "Guardando..." : "Guardar cambios"}</button></div>
            </form>
          ) : <ReadonlyProductDetails product={product} stores={stores} />}
        </div>
      )}
    </article>
  );
}

export function AdminProductsPage() {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setError(null);
    try {
      const [nextProducts, nextCategories, nextStores, nextTags] = await Promise.all([getAdminProducts(), getCategories(), getAdminStores(), getTags()]);
      setProducts(nextProducts);
      setCategories(nextCategories);
      setStores(nextStores);
      setTags(nextTags);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos cargar los productos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleCreateTag(name: string): Promise<Tag> {
    const tag = await createTag(name);
    setTags((current) => current.some((item) => item.id === tag.id) ? current : [...current, tag].sort((a, b) => a.name.localeCompare(b.name, "es")));
    return tag;
  }

  const filteredProducts = products.filter((product) => matchesAdminProductSearch(product, search));
  const visibleProductIds = new Set(filteredProducts.map((product) => product.id));

  return (
    <div className="container admin-page admin-products-page">
      <div className="admin-page-header">
        <div><span className="section-kicker">Admin / Productos</span><h1>Productos</h1><p>Consultá y actualizá la información de los productos que forman parte del catálogo.</p></div>
      </div>

      <div className="admin-products-search">
        <label htmlFor="admin-products-search-input">Buscar productos</label>
        <div className="admin-products-search-control">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>
          <input id="admin-products-search-input" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, marca, categoría o tag" />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda" title="Limpiar búsqueda">×</button>}
        </div>
        {!loading && <p className="admin-products-search-count">{filteredProducts.length} de {products.length} productos</p>}
      </div>

      {error && <div className="inline-alert" role="alert">{error}</div>}
      <section className="admin-products-section" aria-labelledby="admin-products-list-title">
        <div className="admin-card-heading"><div><span className="section-kicker">Catálogo actual</span><h2 id="admin-products-list-title">Productos cargados</h2></div><span className="section-note">Seleccioná uno para ver el detalle</span></div>
        {loading ? <div className="admin-loading"><div className="loading-orb" /><p>Cargando productos...</p></div> : products.length ? <><div className="admin-product-list">{products.map((product) => <AdminProductAccordion key={product.id} product={product} categories={categories} stores={stores} tags={tags} onCreateTag={handleCreateTag} onChanged={loadData} hidden={!visibleProductIds.has(product.id)} />)}</div>{!filteredProducts.length && <div className="state-message admin-products-no-results"><div className="state-icon">⌕</div><div><h3>No encontramos productos</h3><p>Probá con otro nombre, marca, categoría o tag.</p></div></div>}</> : <div className="state-message"><div className="state-icon">◌</div><div><h3>Todavía no hay productos</h3><p>Los productos aprobados o creados desde el panel van a aparecer acá.</p></div></div>}
      </section>
    </div>
  );
}
