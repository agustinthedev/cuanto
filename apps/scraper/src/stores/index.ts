import type { StoreScraper } from "../types";
import { discoScraper } from "./disco";
import { redExpressScraper } from "./red-express";
import { tiendaInglesaScraper } from "./tienda-inglesa";

const scrapers = new Map<string, StoreScraper>([
  [discoScraper.slug, discoScraper],
  [tiendaInglesaScraper.slug, tiendaInglesaScraper],
  [redExpressScraper.slug, redExpressScraper],
]);

export function getScraper(storeSlug: string): StoreScraper | undefined {
  return scrapers.get(storeSlug);
}

export { discoScraper, redExpressScraper, tiendaInglesaScraper };
