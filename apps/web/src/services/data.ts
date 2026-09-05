import { supabase } from "../lib/supabase";
import type {
  AveragePrice,
  AdminAnalytics,
  AdminAnalyticsPageRow,
  AdminAnalyticsProductRow,
  AdminAnalyticsReferralRow,
  AdminAnalyticsSearchRow,
  AdminAnalyticsSummary,
  AdminAnalyticsTrafficPoint,
  AdminAnalyticsZeroResultRow,
  AdminDashboardData,
  AdminProduct,
  AdminSuggestionStats,
  AnalyticsPeriod,
  Category,
  HomepageStats,
  LatestPrice,
  Product,
  ProductPageData,
  ProductLink,
  ProductSuggestion,
  ProductSuggestionLink,
  ProductSuggestionStatus,
  PriceObservationDay,
  Store,
  StorePrice,
  Tag,
} from "./types";
import { isProductUnit, normalizeProductQuantity, type ProductUnit } from "./productMeasurement";
import { demoAveragePrices, demoCategories, demoProducts, demoSuggestionStats, demoSuggestions, demoStats, demoStores, demoTags, getDemoProductPageData } from "./demoData";
import { sortProducts, type ProductSort } from "./productSearch";

const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

const productSelect = "id,name,brand,quantity,unit,image_url,created_at,category:categories(id,name,slug)";
const productSearchSelect = "id,name,brand,quantity,unit,image_url,created_at,category_id,category_name,category_slug,current_price,best_store,comparison_count";
const suggestionSelect = "id,title,category_id,quantity,unit,status,created_at,updated_at,reviewed_at,category:categories(id,name,slug),links:product_suggestion_store_links(id,suggestion_id,store_id,url,store:stores(id,name,slug,active)),tags:product_suggestion_tags(tag:tags(id,name))";
const adminProductSelect = "id,name,brand,quantity,unit,image_url,created_at,updated_at,category:categories(id,name,slug),links:store_products!store_products_product_id_fkey(id,product_id,store_id,url,external_name,active,location_id,store:stores(id,name,slug)),tags:product_tags(tag:tags(id,name))";
const adminProductPageSize = 500;

function normalizeProduct(value: any): Product {
  const category = Array.isArray(value.category) ? value.category[0] : value.category;
  return {
    id: value.id,
    name: value.name,
    brand: value.brand ?? null,
    quantity: Number(value.quantity),
    unit: isProductUnit(value.unit) ? value.unit : "un",
    image_url: value.image_url ?? null,
    category: category ?? null,
    created_at: value.created_at,
  };
}

type HomepagePriceRow = Pick<LatestPrice, "product_id" | "price" | "store_name">;

export function attachLatestPrices(products: Product[], latestPrices: HomepagePriceRow[]): Product[] {
  const bestPriceByProduct = new Map<string, { price: number; store: string }>();
  const comparisonStoresByProduct = new Map<string, Set<string>>();

  latestPrices.forEach((row) => {
    const price = Number(row.price);
    if (!Number.isFinite(price) || price <= 0 || !row.store_name) return;
    const stores = comparisonStoresByProduct.get(row.product_id) ?? new Set<string>();
    stores.add(row.store_name);
    comparisonStoresByProduct.set(row.product_id, stores);
    const current = bestPriceByProduct.get(row.product_id);
    if (!current || price < current.price || (price === current.price && row.store_name.localeCompare(current.store, "es") < 0)) {
      bestPriceByProduct.set(row.product_id, { price, store: row.store_name });
    }
  });

  return products.map((product) => {
    const bestPrice = bestPriceByProduct.get(product.id);
    const comparisonCount = comparisonStoresByProduct.get(product.id)?.size ?? 0;
    if (!bestPrice && !comparisonCount) return product;
    return {
      ...product,
      ...(bestPrice ? { current_price: bestPrice.price, best_store: bestPrice.store } : {}),
      comparison_count: comparisonCount,
    };
  });
}

function normalizeSuggestion(value: any): ProductSuggestion {
  const category = Array.isArray(value.category) ? value.category[0] : value.category;
  const links = (value.links ?? []).map((link: any): ProductSuggestionLink => ({
    id: link.id,
    suggestion_id: link.suggestion_id,
    store_id: link.store_id,
    url: link.url,
    store: Array.isArray(link.store) ? link.store[0] : link.store,
  }));
  const tags = (value.tags ?? [])
    .map((item: any) => Array.isArray(item.tag) ? item.tag[0] : item.tag)
    .filter((tag: Tag | null | undefined): tag is Tag => Boolean(tag))
    .map((tag: Tag) => ({ id: tag.id, name: tag.name }));
  return {
    id: value.id,
    title: value.title,
    category_id: value.category_id,
    quantity: Number(value.quantity),
    unit: isProductUnit(value.unit) ? value.unit : "un",
    category,
    status: value.status,
    created_at: value.created_at,
    updated_at: value.updated_at,
    reviewed_at: value.reviewed_at ?? null,
    links,
    tags,
  };
}

function normalizeProductLink(value: any): ProductLink {
  return {
    id: value.id,
    product_id: value.product_id,
    store_id: value.store_id,
    url: value.url,
    external_name: value.external_name ?? null,
    active: value.active !== false,
    location_id: value.location_id ?? null,
    store: Array.isArray(value.store) ? value.store[0] ?? null : value.store ?? null,
  };
}

function normalizeAdminProduct(value: any): AdminProduct {
  const rawLinks: ProductLink[] = (value.links ?? []).map(normalizeProductLink);
  const linksByStore = new Map<string, ProductLink>();
  for (const link of rawLinks) {
    if (link.location_id !== null) continue;
    const current = linksByStore.get(link.store_id);
    if (!current) linksByStore.set(link.store_id, link);
  }
  const tags = (value.tags ?? [])
    .map((item: any) => Array.isArray(item.tag) ? item.tag[0] : item.tag)
    .filter((tag: Tag | null | undefined): tag is Tag => Boolean(tag))
    .map((tag: Tag) => ({ id: tag.id, name: tag.name }));
  return {
    ...normalizeProduct(value),
    links: [...linksByStore.values()],
    tags,
    has_location_scoped_links: rawLinks.some((link) => link.active && link.location_id !== null),
  };
}

export async function getCategories(): Promise<Category[]> {
  if (isDemoMode) return demoCategories;
  if (!supabase) return [];
  const { data, error } = await supabase.from("categories").select("id,name,slug").order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getAdminStores(): Promise<Store[]> {
  if (isDemoMode) return demoStores.filter((store) => store.active);
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("stores").select("id,name,slug,active").eq("active", true).order("name");
  if (error) throw error;
  return (data ?? []) as Store[];
}

export async function getTags(): Promise<Tag[]> {
  if (isDemoMode) return [...demoTags].sort((a, b) => a.name.localeCompare(b.name, "es"));
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("tags").select("id,name").order("name");
  if (error) throw error;
  return (data ?? []) as Tag[];
}

export async function createTag(name: string): Promise<Tag> {
  const trimmedName = name.trim();
  if (isDemoMode) {
    const existing = demoTags.find((tag) => tag.name.trim().toLocaleLowerCase("es-UY") === trimmedName.toLocaleLowerCase("es-UY"));
    if (existing) return existing;
    const tag = { id: `demo-tag-${trimmedName.toLocaleLowerCase("es-UY").replace(/[^a-z0-9]+/g, "-")}-${Date.now()}`, name: trimmedName };
    demoTags.push(tag);
    return tag;
  }
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("create_tag", { p_name: trimmedName });
  if (error) throw error;
  return data as Tag;
}

export async function getProductSuggestions(): Promise<ProductSuggestion[]> {
  if (isDemoMode) return demoSuggestions;
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase
    .from("product_suggestions")
    .select(suggestionSelect)
    .order("created_at", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(normalizeSuggestion);
}

export async function createProductSuggestion(title: string, categoryId: string, quantity: number, unit: ProductUnit, links: Array<{ store_id: string; url: string }>): Promise<void> {
  if (isDemoMode) return;
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("create_product_suggestion", {
    p_title: title,
    p_category_id: categoryId,
    p_quantity: normalizeProductQuantity(quantity),
    p_unit: unit,
    p_links: links,
  });
  if (error) throw error;
}

export async function createProduct(name: string, categoryId: string, quantity: number, unit: ProductUnit, links: Array<{ store_id: string; url: string }>, tagIds: string[] = []): Promise<string> {
  if (isDemoMode) return "demo-created-product";
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("create_product_with_links", {
    p_name: name,
    p_category_id: categoryId,
    p_quantity: normalizeProductQuantity(quantity),
    p_unit: unit,
    p_links: links,
    p_tag_ids: tagIds,
  });
  if (error) {
    const duplicateLinkPrefix = "The store link is already assigned to another product or store: ";
    if (error.message.startsWith(duplicateLinkPrefix)) {
      throw new Error(`El link ${error.message.slice(duplicateLinkPrefix.length)} ya está almacenado en otro producto o cadena.`);
    }
    throw error;
  }
  return data as string;
}

const demoAdminProductLinks = new Map<string, Array<{ store_id: string; url: string }>>();
const demoAdminProductTags = new Map<string, string[]>();

function demoLinksForProduct(product: Product): ProductLink[] {
  const links = demoAdminProductLinks.get(product.id) ?? demoStores.map((store) => ({
    store_id: store.id,
    url: `https://${store.slug}.com.uy/productos/${product.id}`,
  }));
  return links.filter((link) => link.url.trim()).map((link, index) => ({
    id: `demo-product-link-${product.id}-${index}`,
    product_id: product.id,
    store_id: link.store_id,
    url: link.url,
    external_name: product.name,
    active: true,
    location_id: null,
    store: demoStores.find((store) => store.id === link.store_id) ?? null,
  }));
}

function demoTagsForProduct(product: Product): Tag[] {
  const tagIds = demoAdminProductTags.get(product.id) ?? [];
  return tagIds.map((tagId) => demoTags.find((tag) => tag.id === tagId)).filter((tag): tag is Tag => Boolean(tag));
}

export async function getAdminProducts(): Promise<AdminProduct[]> {
  if (isDemoMode) {
    return demoProducts.map((product) => ({
      ...product,
      links: demoLinksForProduct(product),
      tags: demoTagsForProduct(product),
      has_location_scoped_links: false,
    }));
  }
  if (!supabase) throw new Error("Supabase no está configurado.");
  const products: AdminProduct[] = [];
  for (let offset = 0; ; offset += adminProductPageSize) {
    const { data, error } = await supabase
      .from("products")
      .select(adminProductSelect)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + adminProductPageSize - 1);
    if (error) throw error;
    const page = (data ?? []).map(normalizeAdminProduct);
    products.push(...page);
    if (page.length < adminProductPageSize) return products;
  }
}

export async function updateProduct(id: string, name: string, brand: string, categoryId: string, quantity: number, unit: ProductUnit, links: Array<{ store_id: string; url: string }>, tagIds: string[] = []): Promise<void> {
  if (isDemoMode) {
    const product = demoProducts.find((item) => item.id === id);
    if (!product) throw new Error("El producto no existe.");
    product.name = name.trim();
    product.brand = brand.trim() || null;
    product.quantity = normalizeProductQuantity(quantity);
    product.unit = unit;
    product.category = demoCategories.find((category) => category.id === categoryId) ?? null;
    demoAdminProductLinks.set(id, links);
    demoAdminProductTags.set(id, tagIds);
    return;
  }
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("update_product", {
    p_product_id: id,
    p_name: name,
    p_brand: brand.trim() || null,
    p_category_id: categoryId,
    p_quantity: normalizeProductQuantity(quantity),
    p_unit: unit,
    p_links: links,
    p_tag_ids: tagIds,
  });
  if (error) {
    const duplicateLinkPrefix = "The store link is already assigned to another product or store: ";
    if (error.message.startsWith(duplicateLinkPrefix)) {
      throw new Error(`El link ${error.message.slice(duplicateLinkPrefix.length)} ya está almacenado en otro producto o cadena.`);
    }
    throw error;
  }
}

export async function updateProductSuggestion(id: string, title: string, categoryId: string, quantity: number, unit: ProductUnit, links: Array<{ store_id: string; url: string }>, tagIds: string[] = []): Promise<void> {
  if (isDemoMode) return;
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("update_product_suggestion", {
    p_suggestion_id: id,
    p_title: title,
    p_category_id: categoryId,
    p_quantity: normalizeProductQuantity(quantity),
    p_unit: unit,
    p_links: links,
    p_tag_ids: tagIds,
  });
  if (error) throw error;
}

export async function approveProductSuggestion(id: string, title: string, categoryId: string, quantity: number, unit: ProductUnit, links: Array<{ store_id: string; url: string }>, tagIds: string[], expectedUpdatedAt: string): Promise<string> {
  if (isDemoMode) return "demo-created-product";
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("approve_product_suggestion", {
    p_suggestion_id: id,
    p_title: title,
    p_category_id: categoryId,
    p_quantity: normalizeProductQuantity(quantity),
    p_unit: unit,
    p_links: links,
    p_tag_ids: tagIds,
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) throw error;
  return data as string;
}

export async function triggerProductScrape(productId: string): Promise<void> {
  if (isDemoMode) return;
  if (!supabase) throw new Error("Supabase no está configurado.");
  const scraperUrl = import.meta.env.VITE_SCRAPER_URL?.trim().replace(/\/$/, "");
  if (!scraperUrl) throw new Error("El endpoint del scraper no está configurado.");

  const { data, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!data.session?.access_token) throw new Error("La sesión de administrador expiró.");

  const response = await fetch(`${scraperUrl}/scrape/product`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ product_id: productId }),
  });
  if (!response.ok) throw new Error(`No pudimos iniciar la actualización de precios (HTTP ${response.status}).`);
}

export async function rejectProductSuggestion(id: string): Promise<void> {
  if (isDemoMode) return;
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("reject_product_suggestion", { p_suggestion_id: id });
  if (error) throw error;
}

export interface HomepageProductResult {
  products: Product[];
  total: number;
}

async function getProducts(filters?: { search?: string; categoryId?: string }, limit?: number): Promise<HomepageProductResult> {
  if (isDemoMode) {
    const searchValue = filters?.search?.trim().toLocaleLowerCase("es-UY") ?? "";
    const matchingProducts = demoProducts.filter((product) => {
      const matchesSearch = !searchValue || `${product.name} ${product.brand ?? ""}`.toLocaleLowerCase("es-UY").includes(searchValue);
      const matchesCategory = !filters?.categoryId || product.category?.id === filters.categoryId;
      return matchesSearch && matchesCategory;
    }).map((product) => ({ ...product, comparison_count: demoStores.length }));
    return {
      products: typeof limit === "number" ? matchingProducts.slice(0, limit) : matchingProducts,
      total: matchingProducts.length,
    };
  }
  if (!supabase) return { products: [], total: 0 };
  let query = supabase.from("products").select(productSelect, { count: "exact" }).order("created_at", { ascending: false });
  if (filters?.search?.trim()) query = query.ilike("name", `%${filters.search.trim()}%`);
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  if (typeof limit === "number") query = query.limit(limit);
  const { data, count, error } = await query;
  if (error) throw error;
  const products = (data ?? []).map(normalizeProduct);
  if (!products.length) return { products, total: count ?? 0 };

  const { data: latestPrices, error: latestPricesError } = await supabase
    .from("latest_store_product_prices")
    .select("product_id,price,store_name")
    .in("product_id", products.map((product) => product.id));
  if (latestPricesError) throw latestPricesError;

  return {
    products: attachLatestPrices(products, (latestPrices ?? []) as HomepagePriceRow[]),
    total: count ?? products.length,
  };
}

function normalizeSearchProduct(value: any): Product {
  const product: Product = {
    id: value.id,
    name: value.name,
    brand: value.brand ?? null,
    quantity: Number(value.quantity),
    unit: isProductUnit(value.unit) ? value.unit : "un",
    image_url: value.image_url ?? null,
    category: value.category_id
      ? { id: value.category_id, name: value.category_name ?? "", slug: value.category_slug ?? "" }
      : null,
    created_at: value.created_at,
  };
  const currentPrice = value.current_price === null || value.current_price === undefined ? NaN : Number(value.current_price);
  const comparisonCount = Number(value.comparison_count);
  if (Number.isFinite(currentPrice)) product.current_price = currentPrice;
  if (typeof value.best_store === "string" && value.best_store) product.best_store = value.best_store;
  if (Number.isFinite(comparisonCount)) product.comparison_count = comparisonCount;
  return product;
}

export async function getHomepageProducts(filters?: { search?: string; categoryId?: string }): Promise<HomepageProductResult> {
  return getProducts(filters, 24);
}

export interface ProductSearchPageResult {
  products: Product[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export async function getProductSearchProducts(
  filters?: { search?: string; categoryId?: string },
  options: { page?: number; pageSize?: number; sort?: ProductSort } = {},
): Promise<ProductSearchPageResult> {
  const page = Math.max(0, Math.floor(options.page ?? 0));
  const pageSize = Math.min(48, Math.max(1, Math.floor(options.pageSize ?? 24)));
  const sort = options.sort ?? "relevance";
  const from = page * pageSize;
  const to = from + pageSize - 1;

  if (isDemoMode) {
    const searchValue = filters?.search?.trim().toLocaleLowerCase("es-UY") ?? "";
    const matchingProducts = demoProducts
      .filter((product) => {
        const matchesSearch = !searchValue || `${product.name} ${product.brand ?? ""}`.toLocaleLowerCase("es-UY").includes(searchValue);
        const matchesCategory = !filters?.categoryId || product.category?.id === filters.categoryId;
        return matchesSearch && matchesCategory;
      })
      .map((product) => ({ ...product, comparison_count: demoStores.length }));
    const sortedProducts = sortProducts(matchingProducts, sort);
    const products = sortedProducts.slice(from, to + 1);
    return { products, total: sortedProducts.length, page, pageSize, hasMore: from + products.length < sortedProducts.length };
  }
  if (!supabase) return { products: [], total: 0, page, pageSize, hasMore: false };

  let query = supabase
    .from("product_search_results")
    .select(productSearchSelect, { count: "exact" });
  const searchValue = filters?.search?.trim();
  if (searchValue) query = query.ilike("search_text", `%${searchValue}%`);
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);

  if (sort === "price-asc") {
    query = query.order("current_price", { ascending: true, nullsFirst: false }).order("name").order("id");
  } else if (sort === "price-desc") {
    query = query.order("current_price", { ascending: false, nullsFirst: false }).order("name").order("id");
  } else if (sort === "coverage-desc") {
    query = query.order("comparison_count", { ascending: false, nullsFirst: false }).order("name").order("id");
  } else if (sort === "name-asc") {
    query = query.order("name").order("id");
  } else {
    query = query.order("created_at", { ascending: false }).order("id");
  }

  const { data, count, error } = await query.range(from, to);
  if (error) throw error;
  const products = (data ?? []).map(normalizeSearchProduct);
  const total = count ?? 0;
  return { products, total, page, pageSize, hasMore: from + products.length < total };
}

async function countRows(table: string, column = "id"): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase.from(table).select(column, { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

async function countActiveStores(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.rpc("count_active_stores");
  if (error) throw error;
  return Number(data ?? 0);
}

async function countSuggestions(status?: ProductSuggestionStatus): Promise<number> {
  if (!supabase) return 0;
  let query = supabase.from("product_suggestions").select("id", { count: "exact", head: true });
  if (status) query = query.eq("status", status);
  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

function uruguayDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateValue: string, days: number): string {
  const date = new Date(`${dateValue}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function fillObservationHistory(rows: PriceObservationDay[], startDate: string, endDate: string): PriceObservationDay[] {
  const counts = new Map(rows.map((row) => [row.date, Number(row.observation_count)]));
  const history: PriceObservationDay[] = [];
  for (let date = startDate; date <= endDate; date = addDays(date, 1)) {
    history.push({ date, observation_count: counts.get(date) ?? 0 });
  }
  return history;
}

export async function getHomepageStats(): Promise<HomepageStats> {
  if (isDemoMode) return demoStats;
  if (!supabase) return { products: 0, stores: 0, observations: 0, days: 0 };
  const [products, stores, observations, days] = await Promise.all([
    countRows("products"),
    countActiveStores(),
    countRows("prices"),
    countRows("price_observation_days", "date"),
  ]);
  return { products, stores, observations, days };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  if (isDemoMode) {
    return {
      stats: demoStats,
      suggestions: demoSuggestionStats,
      observationHistory: demoAveragePrices.map((item) => ({ date: item.date, observation_count: item.observation_count })),
    };
  }
  if (!supabase) {
    return {
      stats: { products: 0, stores: 0, observations: 0, days: 0 },
      suggestions: { pending: 0, approved: 0, rejected: 0, total: 0 },
      observationHistory: [],
    };
  }

  const endDate = uruguayDate();
  const startDate = addDays(endDate, -13);
  const [stats, pending, approved, rejected, observationsResult] = await Promise.all([
    getHomepageStats(),
    countSuggestions("pending"),
    countSuggestions("approved"),
    countSuggestions("rejected"),
    supabase.from("price_observation_days").select("date,observation_count").gte("date", startDate).lte("date", endDate).order("date"),
  ]);
  if (observationsResult.error) throw observationsResult.error;

  const suggestions: AdminSuggestionStats = {
    pending,
    approved,
    rejected,
    total: pending + approved + rejected,
  };

  return {
    stats,
    suggestions,
    observationHistory: fillObservationHistory((observationsResult.data ?? []) as PriceObservationDay[], startDate, endDate),
  };
}

export const emptyAdminAnalytics: AdminAnalytics = {
  period: "30d",
  summary: {
    uniqueVisitors: 0,
    sessions: 0,
    pageViews: 0,
    productViews: 0,
    searches: 0,
    zeroResultSearches: 0,
    zeroResultPercentage: 0,
    pagesPerSession: 0,
    searchesPerSession: 0,
  },
  traffic: [],
  mostViewedProducts: [],
  topSearches: [],
  zeroResultSearches: [],
  mostVisitedPages: [],
  topProductReferrals: [],
};

function analyticsNumber(value: unknown, fallback = 0): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

export function normalizeAdminAnalytics(value: unknown, period: AnalyticsPeriod): AdminAnalytics {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawSummary = raw.summary && typeof raw.summary === "object" ? raw.summary as Record<string, unknown> : {};
  const rawRows = (key: string) => Array.isArray(raw[key]) ? raw[key] : [];
  const rowObject = (row: unknown) => row && typeof row === "object" ? row as Record<string, unknown> : {};

  const summary: AdminAnalyticsSummary = {
    uniqueVisitors: analyticsNumber(rawSummary.unique_visitors),
    sessions: analyticsNumber(rawSummary.sessions),
    pageViews: analyticsNumber(rawSummary.page_views),
    productViews: analyticsNumber(rawSummary.product_views),
    searches: analyticsNumber(rawSummary.searches),
    zeroResultSearches: analyticsNumber(rawSummary.zero_result_searches),
    zeroResultPercentage: analyticsNumber(rawSummary.zero_result_percentage),
    pagesPerSession: analyticsNumber(rawSummary.pages_per_session),
    searchesPerSession: analyticsNumber(rawSummary.searches_per_session),
  };

  const traffic: AdminAnalyticsTrafficPoint[] = rawRows("traffic").map((row) => {
    const item = rowObject(row);
    return {
      bucket: typeof item.bucket === "string" ? item.bucket : "",
      uniqueVisitors: analyticsNumber(item.unique_visitors),
      sessions: analyticsNumber(item.sessions),
      pageViews: analyticsNumber(item.page_views),
      searches: analyticsNumber(item.searches),
    };
  }).filter((row) => row.bucket);

  const mostViewedProducts: AdminAnalyticsProductRow[] = rawRows("most_viewed_products").map((row) => {
    const item = rowObject(row);
    return {
      productId: String(item.product_id ?? ""),
      productName: String(item.product_name ?? "Producto eliminado"),
      views: analyticsNumber(item.views),
      uniqueVisitors: analyticsNumber(item.unique_visitors),
    };
  });

  const topSearches: AdminAnalyticsSearchRow[] = rawRows("top_searches").map((row) => {
    const item = rowObject(row);
    return {
      query: String(item.query ?? ""),
      searches: analyticsNumber(item.searches),
      averageResultCount: analyticsNumber(item.average_result_count),
      uniqueVisitors: analyticsNumber(item.unique_visitors),
    };
  }).filter((row) => row.query);

  const zeroResultSearches: AdminAnalyticsZeroResultRow[] = rawRows("zero_result_searches").map((row) => {
    const item = rowObject(row);
    return {
      query: String(item.query ?? ""),
      searches: analyticsNumber(item.searches),
      lastSearchedAt: String(item.last_searched_at ?? ""),
    };
  }).filter((row) => row.query);

  const mostVisitedPages: AdminAnalyticsPageRow[] = rawRows("most_visited_pages").map((row) => {
    const item = rowObject(row);
    return { page: String(item.page ?? ""), views: analyticsNumber(item.views) };
  }).filter((row) => row.page);

  const topProductReferrals: AdminAnalyticsReferralRow[] = rawRows("top_product_referrals").map((row) => {
    const item = rowObject(row);
    return {
      referringProductId: String(item.referring_product_id ?? ""),
      referringProductName: String(item.referring_product_name ?? "Producto eliminado"),
      destinationProductId: String(item.destination_product_id ?? ""),
      destinationProductName: String(item.destination_product_name ?? "Producto eliminado"),
      visits: analyticsNumber(item.visits),
      destinationViewPercentage: analyticsNumber(item.destination_view_percentage),
    };
  });

  return {
    period,
    summary,
    traffic,
    mostViewedProducts,
    topSearches,
    zeroResultSearches,
    mostVisitedPages,
    topProductReferrals,
  };
}

export async function getAdminAnalytics(period: AnalyticsPeriod): Promise<AdminAnalytics> {
  if (isDemoMode || !supabase) return { ...emptyAdminAnalytics, period };
  const { data, error } = await supabase.rpc("get_admin_analytics", { p_period: period });
  if (error) throw error;
  return normalizeAdminAnalytics(data, period);
}

export async function getProductPageData(id: string): Promise<ProductPageData> {
  if (isDemoMode) return getDemoProductPageData(id);
  if (!supabase) return { product: null, latestPrices: [], averagePrices: [], storePrices: [] };
  const [productResult, latestResult, averageResult, storeResult] = await Promise.all([
    supabase.from("products").select(productSelect).eq("id", id).maybeSingle(),
    supabase.from("latest_store_product_prices").select("*").eq("product_id", id).order("store_name"),
    supabase.from("product_daily_average_prices").select("*").eq("product_id", id).order("date"),
    supabase.from("product_daily_store_prices").select("*").eq("product_id", id).order("date"),
  ]);
  if (productResult.error) throw productResult.error;
  if (latestResult.error) throw latestResult.error;
  if (averageResult.error) throw averageResult.error;
  if (storeResult.error) throw storeResult.error;
  return {
    product: productResult.data ? normalizeProduct(productResult.data) : null,
    latestPrices: (latestResult.data ?? []) as LatestPrice[],
    averagePrices: (averageResult.data ?? []) as AveragePrice[],
    storePrices: (storeResult.data ?? []) as StorePrice[],
  };
}
