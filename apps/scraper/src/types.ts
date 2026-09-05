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

export interface ScrapeResult {
  price: number;
  source: "html" | "json";
  imageUrl?: string;
}

export interface ElDoradoSession {
  origin: string;
  cookie: string;
}

export interface ScrapeContext {
  elDoradoSession?: ElDoradoSession;
}

export interface StoreScraper {
  slug: string;
  scrape(record: StoreProductRecord, env: Env, context?: ScrapeContext): Promise<ScrapeResult>;
}

export interface ScrapeSummary {
  attempted: number;
  saved: number;
  failed: number;
}
