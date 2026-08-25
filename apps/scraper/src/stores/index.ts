import type { StoreScraper } from "../types";
import { discoScraper } from "./disco";
import { tataScraper } from "./tata";
import { tiendaInglesaScraper } from "./tienda-inglesa";

const scrapers = new Map<string, StoreScraper>([
  [discoScraper.slug, discoScraper],
  [tiendaInglesaScraper.slug, tiendaInglesaScraper],
  [tataScraper.slug, tataScraper],
]);

export function getScraper(storeSlug: string): StoreScraper | undefined {
  return scrapers.get(storeSlug);
}

export { discoScraper, tataScraper, tiendaInglesaScraper };
