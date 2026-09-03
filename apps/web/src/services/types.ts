import type { ProductUnit } from "./productMeasurement";

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
}

export type ProductSuggestionStatus = "pending" | "approved" | "rejected";

export interface ProductSuggestionLink {
  id: string;
  suggestion_id: string;
  store_id: string;
  url: string;
  store: Store;
}

export interface ProductSuggestion {
  id: string;
  title: string;
  category_id: string;
  quantity: number;
  unit: ProductUnit;
  category: Category;
  status: ProductSuggestionStatus;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  links: ProductSuggestionLink[];
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit: ProductUnit;
  image_url: string | null;
  category: Category | null;
  created_at: string;
  current_price?: number;
  best_store?: string;
  comparison_count?: number;
}

export interface LatestPrice {
  store_product_id: string;
  product_id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  location_id: string | null;
  location_name: string | null;
  url: string;
  price: number;
  date: string;
  scraped_at: string;
}

export interface AveragePrice {
  product_id: string;
  date: string;
  average_price: number;
  observation_count: number;
}

export interface StorePrice {
  product_id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  date: string;
  price: number;
  observation_count: number;
}

export interface HomepageStats {
  products: number;
  stores: number;
  observations: number;
  days: number;
}

export interface PriceObservationDay {
  date: string;
  observation_count: number;
}

export interface AdminSuggestionStats {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export interface AdminDashboardData {
  stats: HomepageStats;
  suggestions: AdminSuggestionStats;
  observationHistory: PriceObservationDay[];
}

export interface ProductPageData {
  product: Product | null;
  latestPrices: LatestPrice[];
  averagePrices: AveragePrice[];
  storePrices: StorePrice[];
}
