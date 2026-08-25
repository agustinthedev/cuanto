export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string | null;
  quantity: number;
  unit: string;
  image_url: string | null;
  category: Category | null;
  created_at: string;
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

export interface ProductPageData {
  product: Product | null;
  latestPrices: LatestPrice[];
  averagePrices: AveragePrice[];
  storePrices: StorePrice[];
}
