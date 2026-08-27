import { supabase } from "../lib/supabase";
import type {
  AveragePrice,
  Category,
  HomepageStats,
  LatestPrice,
  Product,
  ProductPageData,
  ProductSuggestion,
  ProductSuggestionLink,
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
