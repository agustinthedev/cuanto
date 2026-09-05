export interface StoreProductRecord {
  id: string;
  product_id: string;
  store_id: string;
  location_id: string | null;
  url: string;
  external_name: string | null;
  image_url: string | null;
  store_slug: string;
}

export interface ScrapeQueueMessage {
  run_id: string;
  date: string;
  product_id: string;
  product_image_url: string | null;
  store_products: StoreProductRecord[];
  tienda_inglesa_fallback_origins?: string[];
  tienda_inglesa_previously_failed_origins?: string[];
}

export interface ScrapeResult {
  price: number;
  source: "html" | "json";
  imageUrl?: string;
}

export interface ElDoradoSession {
  origin: string;
  cookie: string;
}

export interface StoreScrapeContext {
  tiendaInglesaFallbackOrigins?: string[];
  tiendaInglesaPreviouslyFailedOrigins?: string[];
  elDoradoSession?: ElDoradoSession;
}

export interface StoreScraper {
  slug: string;
  scrape(record: StoreProductRecord, env: Env, context?: StoreScrapeContext): Promise<ScrapeResult>;
}

export interface ScrapeSummary {
  attempted: number;
  saved: number;
  failed: number;
}
