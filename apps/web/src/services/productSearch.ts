import type { Product } from "./types";

export const productSortOptions = [
  { value: "relevance", label: "Más relevantes" },
  { value: "price-asc", label: "Precio: menor a mayor" },
  { value: "price-desc", label: "Precio: mayor a menor" },
  { value: "coverage-desc", label: "Más cadenas comparadas" },
  { value: "name-asc", label: "Nombre: A–Z" },
] as const;

export type ProductSort = (typeof productSortOptions)[number]["value"];

export function parseProductSort(value: string | null): ProductSort {
  return productSortOptions.some((option) => option.value === value)
    ? value as ProductSort
    : "relevance";
}

function productPrice(product: Product) {
  return typeof product.current_price === "number" && Number.isFinite(product.current_price)
    ? product.current_price
    : null;
}

function comparePrices(left: Product, right: Product, direction: "asc" | "desc") {
  const leftPrice = productPrice(left);
  const rightPrice = productPrice(right);
  if (leftPrice === null && rightPrice === null) return 0;
  if (leftPrice === null) return 1;
  if (rightPrice === null) return -1;
  return direction === "asc" ? leftPrice - rightPrice : rightPrice - leftPrice;
}

export function sortProducts(products: Product[], sort: ProductSort) {
  if (sort === "relevance") return products;

  return [...products].sort((left, right) => {
    if (sort === "price-asc") return comparePrices(left, right, "asc") || left.name.localeCompare(right.name, "es");
    if (sort === "price-desc") return comparePrices(left, right, "desc") || left.name.localeCompare(right.name, "es");
    if (sort === "coverage-desc") return (right.comparison_count ?? 0) - (left.comparison_count ?? 0) || left.name.localeCompare(right.name, "es");
    return left.name.localeCompare(right.name, "es");
  });
}

export function buildProductSearchUrl(search: string, categoryId: string, sort: ProductSort = "relevance") {
  const params = new URLSearchParams();
  if (search.trim()) params.set("q", search.trim());
  if (categoryId) params.set("category", categoryId);
  if (sort !== "relevance") params.set("sort", sort);
  const query = params.toString();
  return `/productos${query ? `?${query}` : ""}`;
}
