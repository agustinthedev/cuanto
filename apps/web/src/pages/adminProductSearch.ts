import type { AdminProduct } from "../services/types";

function normalizeSearchValue(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-UY");
}

export function matchesAdminProductSearch(product: AdminProduct, query: string) {
  const searchValue = normalizeSearchValue(query.trim());
  if (!searchValue) return true;

  return [
    product.name,
    product.brand ?? "",
    product.category?.name ?? "",
    ...product.tags.map((tag) => tag.name),
  ].some((value) => normalizeSearchValue(value).includes(searchValue));
}
