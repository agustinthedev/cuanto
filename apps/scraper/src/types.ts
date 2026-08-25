export interface StoreProductRecord {
  id: string;
  product_id: string;
  store_id: string;
  location_id: string | null;
  url: string;
  external_name: string | null;
  store_slug: string;
}

export interface ScrapeResult {
  price: number;
  source: "html" | "json";
}

export interface StoreScraper {
  slug: string;
  scrape(record: StoreProductRecord, env: Env): Promise<ScrapeResult>;
}

export interface ScrapeSummary {
  attempted: number;
  saved: number;
  failed: number;
}
