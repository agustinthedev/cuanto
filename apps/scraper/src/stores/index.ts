import type { StoreScraper } from "../types";
import { discoScraper } from "./disco";
import { elDoradoScraper } from "./el-dorado";
import { tataScraper } from "./tata";
import { tiendaInglesaScraper } from "./tienda-inglesa";

const scrapers = new Map<string, StoreScraper>([
  [discoScraper.slug, discoScraper],
  [elDoradoScraper.slug, elDoradoScraper],
  [tiendaInglesaScraper.slug, tiendaInglesaScraper],
  [tataScraper.slug, tataScraper],
]);

export function getScraper(storeSlug: string): StoreScraper | undefined {
  return scrapers.get(storeSlug);
}

export { discoScraper, elDoradoScraper, tataScraper, tiendaInglesaScraper };
