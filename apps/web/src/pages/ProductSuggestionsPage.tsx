import { useEffect, useState } from "react";
import {
  approveProductSuggestion,
  createProduct,
  getAdminStores,
  getCategories,
  getProductSuggestions,
  rejectProductSuggestion,
  updateProductSuggestion,
} from "../services/data";
import type { Category, ProductSuggestion, ProductSuggestionStatus, Store } from "../services/types";

type StatusFilter = ProductSuggestionStatus | "all";
type LinkDraft = { storeId: string; url: string };

const statusLabels: Record<ProductSuggestionStatus, string> = {
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
};

function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function initialLinks(stores: Store[], suggestion?: ProductSuggestion): LinkDraft[] {
  return stores.map((store) => ({
    storeId: store.id,
    url: suggestion?.links.find((link) => link.store_id === store.id)?.url ?? "",
  }));
}

function linksError(links: LinkDraft[], stores: Store[]) {
  if (!stores.length) return "No hay cadenas configuradas para cargar este producto.";
  const missing = links.find((link) => !isHttpUrl(link.url));
  if (missing) {
    const store = stores.find((item) => item.id === missing.storeId);
    return `Ingresá un link http(s) válido para ${store?.name ?? "cada cadena"}.`;
  }
  return null;
}

function StoreLinkFields({ links, stores, onChange, disabled = false }: { links: LinkDraft[]; stores: Store[]; onChange: (storeId: string, url: string) => void; disabled?: boolean }) {
  return (
    <div className="admin-links-list">
      {stores.map((store) => {
        const link = links.find((item) => item.storeId === store.id);
        const validUrl = Boolean(link?.url && isHttpUrl(link.url));
        return (
          <div className="admin-link-row" key={store.id}>
            <span className="admin-store-label"><span className={`store-avatar store-${store.slug}`}>{store.name.slice(0, 1)}</span>{store.name}</span>
            <input
              type="url"
              value={link?.url ?? ""}
              onChange={(event) => onChange(store.id, event.target.value)}
              placeholder="https://..."
              aria-label={`Link de ${store.name}`}
              required
              disabled={disabled}
            />
            {validUrl ? <a className="admin-open-link" href={link?.url} target="_blank" rel="noreferrer noopener" aria-label={`Abrir link de ${store.name}`}>↗</a> : <span className="admin-open-link disabled" aria-hidden="true">↗</span>}
          </div>
        );
      })}
    </div>
  );
}

function CreateProductModal({ categories, stores, onClose, onCreated }: { categories: Category[]; stores: Store[]; onClose: () => void; onCreated: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [links, setLinks] = useState<LinkDraft[]>(() => initialLinks(stores));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLinks((current) => stores.map((store) => ({ storeId: store.id, url: current.find((link) => link.storeId === store.id)?.url ?? "" })));
  }, [stores]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, saving]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!categoryId && !categories[0]?.id) {
      setError("Elegí una categoría antes de guardar.");
      return;
    }
    const linkValidation = linksError(links, stores);
    if (linkValidation) {
      setError(linkValidation);
      return;
    }
    setSaving(true);
    try {
      await createProduct(title, categoryId || categories[0].id, links.map((link) => ({ store_id: link.storeId, url: link.url.trim() })));
      setTitle("");
      setCategoryId("");
      setLinks(initialLinks(stores));
      await onCreated();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos crear el producto.");
    } finally {
      setSaving(false);
    }
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !saving) onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropClick}>
      <section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="create-product-title">
        <div className="admin-modal-header">
          <div><span className="section-kicker">Carga manual</span><h2 id="create-product-title">Nuevo producto</h2><p>El producto se agrega directamente al catálogo, sin pasar por revisión.</p></div>
          <button className="modal-close" type="button" onClick={onClose} disabled={saving} aria-label="Cerrar">×</button>
        </div>
        {error && <div className="inline-alert" role="alert">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="admin-form-grid">
            <label>Título del producto<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Yerba mate 1 kg" maxLength={200} required /></label>
            <label>Categoría<select value={categoryId || categories[0]?.id || ""} onChange={(event) => setCategoryId(event.target.value)} required><option value="" disabled>Seleccioná una categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          </div>
          <fieldset className="admin-links-fieldset"><legend>Links por cadena</legend><StoreLinkFields links={links} stores={stores} onChange={(storeId, url) => setLinks((current) => current.map((link) => link.storeId === storeId ? { ...link, url } : link))} /></fieldset>
          <div className="admin-form-actions"><button className="button button-secondary" type="button" onClick={onClose} disabled={saving}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? "Creando..." : "Crear producto"}<span>＋</span></button></div>
        </form>
      </section>
    </div>
  );
}

function SuggestionCard({ suggestion, categories, stores, onChanged }: { suggestion: ProductSuggestion; categories: Category[]; stores: Store[]; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState(suggestion.title);
  const [categoryId, setCategoryId] = useState(suggestion.category_id);
  const [links, setLinks] = useState<LinkDraft[]>(() => initialLinks(stores, suggestion));
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "approve" | "reject" | null>(null);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const linkValidation = linksError(links, stores);
    if (linkValidation) {
      setError(linkValidation);
      return;
    }
    setBusyAction("save");
    try {
      await updateProductSuggestion(suggestion.id, title, categoryId, links.map((link) => ({ store_id: link.storeId, url: link.url.trim() })));
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar los cambios.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApprove() {
    setError(null);
    const linkValidation = linksError(links, stores);
    if (linkValidation) {
      setError(linkValidation);
      return;
    }
    setBusyAction("approve");
    try {
      await approveProductSuggestion(
        suggestion.id,
        title,
        categoryId,
        links.map((link) => ({ store_id: link.storeId, url: link.url.trim() })),
      );
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos aprobar la propuesta.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleReject() {
    if (!window.confirm("¿Rechazar esta propuesta?")) return;
    setError(null);
    setBusyAction("reject");
    try {
      await rejectProductSuggestion(suggestion.id);
      await onChanged();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos rechazar la propuesta.");
    } finally {
      setBusyAction(null);
    }
  }

  const categoryName = categories.find((category) => category.id === categoryId)?.name ?? suggestion.category.name;
  const editable = suggestion.status === "pending";
  return (
    <article className="suggestion-card">
      <div className="suggestion-card-topline"><span className={`suggestion-status suggestion-status-${suggestion.status}`}>{statusLabels[suggestion.status]}</span><span className="suggestion-date">Cargado {new Intl.DateTimeFormat("es-UY", { dateStyle: "medium" }).format(new Date(suggestion.created_at))}</span></div>
      {error && <div className="inline-alert" role="alert">{error}</div>}
      <form onSubmit={handleSave}>
        <div className="admin-form-grid">
          <label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={200} required disabled={!editable} /></label>
          <label>Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required disabled={!editable}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><small className="admin-field-hint">{editable ? `Actual: ${categoryName}` : "Propuesta revisada; edición bloqueada"}</small></label>
        </div>
        <fieldset className="admin-links-fieldset"><legend>Links por cadena</legend><div className={!editable ? "admin-readonly-links" : ""}><StoreLinkFields links={links} stores={stores} disabled={!editable} onChange={(storeId, url) => setLinks((current) => current.map((link) => link.storeId === storeId ? { ...link, url } : link))} /></div></fieldset>
        <div className="suggestion-actions">
          {editable && <button className="button button-secondary" type="submit" disabled={busyAction !== null}>{busyAction === "save" ? "Guardando..." : "Guardar cambios"}</button>}
          {suggestion.status === "pending" && <><button className="button button-approve" type="button" onClick={() => void handleApprove()} disabled={busyAction !== null}>{busyAction === "approve" ? "Aprobando..." : "Aprobar"}</button><button className="button button-reject" type="button" onClick={() => void handleReject()} disabled={busyAction !== null}>{busyAction === "reject" ? "Rechazando..." : "Rechazar"}</button></>}
        </div>
      </form>
    </article>
  );
}

export function ProductSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [filter, setFilter] = useState<StatusFilter>("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadData() {
    setError(null);
    try {
      const [nextSuggestions, nextCategories, nextStores] = await Promise.all([getProductSuggestions(), getCategories(), getAdminStores()]);
      setSuggestions(nextSuggestions);
      setCategories(nextCategories);
      setStores(nextStores);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos cargar las propuestas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const pendingCount = suggestions.filter((suggestion) => suggestion.status === "pending").length;
  const filteredSuggestions = filter === "all" ? suggestions : suggestions.filter((suggestion) => suggestion.status === filter);

  return (
    <div className="container admin-page">
      <div className="admin-page-header">
        <div><span className="section-kicker">Admin / catálogo</span><h1>Productos sugeridos</h1><p>Revisá, corregí y aprobá los productos que van a entrar al seguimiento diario.</p></div>
        <button className="button button-primary admin-page-header-action" type="button" onClick={() => { setSuccessMessage(null); setShowCreateModal(true); }}>Crear producto <span>＋</span></button>
      </div>

      <div className="admin-stats" aria-label="Resumen de propuestas"><div><strong>{pendingCount}</strong><span>Pendientes</span></div><div><strong>{suggestions.filter((suggestion) => suggestion.status === "approved").length}</strong><span>Aprobados</span></div><div><strong>{suggestions.length}</strong><span>Total cargadas</span></div></div>

      {error && <div className="inline-alert" role="alert">{error}</div>}
      {successMessage && <div className="inline-alert inline-alert-success" role="status">{successMessage}</div>}

      <section className="admin-review-section">
        <div className="admin-card-heading"><div><span className="section-kicker">Bandeja de revisión</span><h2>Propuestas cargadas</h2></div><div className="admin-filter-tabs" role="tablist" aria-label="Filtrar propuestas">{(["pending", "approved", "rejected", "all"] as StatusFilter[]).map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)} role="tab" aria-selected={filter === item}>{item === "all" ? "Todas" : statusLabels[item]}</button>)}</div></div>
        {loading ? <div className="admin-loading"><div className="loading-orb" /><p>Cargando propuestas...</p></div> : filteredSuggestions.length ? <div className="suggestion-list">{filteredSuggestions.map((suggestion) => <SuggestionCard key={suggestion.id} suggestion={suggestion} categories={categories} stores={stores} onChanged={loadData} />)}</div> : <div className="state-message"><div className="state-icon">✓</div><div><h3>{filter === "pending" ? "No hay propuestas pendientes" : "Todavía no hay propuestas en esta vista"}</h3><p>Las nuevas cargas van a aparecer acá para que puedas revisarlas.</p></div></div>}
      </section>

      {showCreateModal && <CreateProductModal categories={categories} stores={stores} onClose={() => setShowCreateModal(false)} onCreated={async () => { await loadData(); setSuccessMessage("Producto guardado en el catálogo."); }} />}
    </div>
  );
}
