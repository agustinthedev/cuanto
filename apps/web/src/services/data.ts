import { supabase } from "../lib/supabase";
import type {
  AveragePrice,
  AdminDashboardData,
  AdminSuggestionStats,
  Category,
  HomepageStats,
  LatestPrice,
  Product,
  ProductPageData,
  ProductSuggestion,
  ProductSuggestionLink,
  ProductSuggestionStatus,
  PriceObservationDay,
  Store,
  StorePrice,
} from "./types";

const productSelect = "id,name,brand,quantity,unit,image_url,created_at,category:categories(id,name,slug)";
const suggestionSelect = "id,title,category_id,status,created_at,updated_at,reviewed_at,category:categories(id,name,slug),links:product_suggestion_store_links(id,suggestion_id,store_id,url,store:stores(id,name,slug))";

function normalizeProduct(value: any): Product {
  const category = Array.isArray(value.category) ? value.category[0] : value.category;
  return {
    id: value.id,
    name: value.name,
    brand: value.brand ?? null,
    quantity: Number(value.quantity),
    unit: value.unit,
    image_url: value.image_url ?? null,
    category: category ?? null,
    created_at: value.created_at,
  };
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
  return {
    id: value.id,
    title: value.title,
    category_id: value.category_id,
    category,
    status: value.status,
    created_at: value.created_at,
    updated_at: value.updated_at,
    reviewed_at: value.reviewed_at ?? null,
    links,
  };
}

export async function getCategories(): Promise<Category[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("categories").select("id,name,slug").order("name");
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function getAdminStores(): Promise<Store[]> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("stores").select("id,name,slug").order("name");
  if (error) throw error;
  return (data ?? []) as Store[];
}

export async function getProductSuggestions(): Promise<ProductSuggestion[]> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.from("product_suggestions").select(suggestionSelect).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(normalizeSuggestion);
}

export async function createProductSuggestion(title: string, categoryId: string, links: Array<{ store_id: string; url: string }>): Promise<void> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("create_product_suggestion", {
    p_title: title,
    p_category_id: categoryId,
    p_links: links,
  });
  if (error) throw error;
}

export async function createProduct(name: string, categoryId: string, links: Array<{ store_id: string; url: string }>): Promise<string> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { data, error } = await supabase.rpc("create_product_with_links", {
    p_name: name,
    p_category_id: categoryId,
    p_links: links,
  });
  if (error) throw error;
  return data as string;
}

export async function updateProductSuggestion(id: string, title: string, categoryId: string, links: Array<{ store_id: string; url: string }>): Promise<void> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("update_product_suggestion", {
    p_suggestion_id: id,
    p_title: title,
    p_category_id: categoryId,
    p_links: links,
  });
  if (error) throw error;
}

export async function approveProductSuggestion(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("approve_product_suggestion", { p_suggestion_id: id });
  if (error) throw error;
}

export async function rejectProductSuggestion(id: string): Promise<void> {
  if (!supabase) throw new Error("Supabase no está configurado.");
  const { error } = await supabase.rpc("reject_product_suggestion", { p_suggestion_id: id });
  if (error) throw error;
}

export async function getHomepageProducts(filters?: { search?: string; categoryId?: string }): Promise<Product[]> {
  if (!supabase) return [];
  let query = supabase.from("products").select(productSelect).order("created_at", { ascending: false }).limit(24);
  if (filters?.search?.trim()) query = query.ilike("name", `%${filters.search.trim()}%`);
  if (filters?.categoryId) query = query.eq("category_id", filters.categoryId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(normalizeProduct);
}

async function countRows(table: string, column = "id"): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase.from(table).select(column, { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
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
  if (!supabase) return { products: 0, stores: 0, observations: 0, days: 0 };
  const [products, stores, observations, days] = await Promise.all([
    countRows("products"),
    countRows("stores"),
    countRows("prices"),
    countRows("price_observation_days", "date"),
  ]);
  return { products, stores, observations, days };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
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

export async function getProductPageData(id: string): Promise<ProductPageData> {
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
