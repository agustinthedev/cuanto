interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SCRAPE_QUEUE?: Queue<unknown>;
  CORS_ORIGIN?: string;
  TIENDA_INGLESA_FALLBACK_ORIGIN?: string;
  RED_EXPRESS_LOCAL_ID?: string;
  RED_EXPRESS_BASIC_AUTH?: string;
}
