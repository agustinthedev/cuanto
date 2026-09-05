import type { Store } from "../services/types";

export type ProductLinkDraft = { storeId: string; url: string };

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function productLinksError(links: ProductLinkDraft[], stores: Store[]) {
  if (!stores.length) return "No hay cadenas configuradas para cargar este producto.";

  const invalid = links.find((link) => link.url.trim() && !isHttpUrl(link.url));
  if (invalid) {
    const store = stores.find((item) => item.id === invalid.storeId);
    return `Ingresá un link http(s) válido para ${store?.name ?? "la cadena seleccionada"}.`;
  }

  if (!links.some((link) => isHttpUrl(link.url))) {
    return "Ingresá al menos un link http(s) válido para guardar el producto.";
  }

  return null;
}

export function serializeProductLinks(links: ProductLinkDraft[]) {
  return links
    .filter((link) => link.url.trim())
    .map((link) => ({ store_id: link.storeId, url: link.url.trim() }));
}
