import type { AdminSuggestionStats, AveragePrice, Category, HomepageStats, LatestPrice, Product, ProductPageData, ProductSuggestion, ProductSuggestionLink, Store, StorePrice, Tag } from "./types";

export const demoCategories: Category[] = [
  { id: "category-almacen", name: "Almacén", slug: "almacen" },
  { id: "category-bebidas", name: "Bebidas", slug: "bebidas" },
  { id: "category-lacteos", name: "Lácteos", slug: "lacteos" },
  { id: "category-limpieza", name: "Limpieza", slug: "limpieza" },
  { id: "category-cuidado", name: "Cuidado personal", slug: "cuidado-personal" },
];

export const demoStores: Store[] = [
  { id: "store-disco", name: "Disco", slug: "disco" },
  { id: "store-tienda-inglesa", name: "Tienda Inglesa", slug: "tienda-inglesa" },
  { id: "store-ta-ta", name: "Ta-Ta", slug: "ta-ta" },
];

export const demoTags: Tag[] = [
  { id: "demo-tag-organico", name: "Orgánico" },
  { id: "demo-tag-sin-tacc", name: "Sin TACC" },
  { id: "demo-tag-oferta", name: "Oferta" },
];

const images = {
  oliveOil: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=700&q=85",
  coffee: "https://images.unsplash.com/photo-1512568400610-62da28bc8a13?auto=format&fit=crop&w=700&q=85",
  milk: "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=700&q=85",
  pasta: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?auto=format&fit=crop&w=700&q=85",
  detergent: "https://images.unsplash.com/photo-1583947215259-38e31be8751f?auto=format&fit=crop&w=700&q=85",
  yerba: "https://images.unsplash.com/photo-1594631252845-29fc4cc8cde9?auto=format&fit=crop&w=700&q=85",
  shampoo: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=700&q=85",
  cereal: "https://images.unsplash.com/photo-1517093157656-b9eccef91cb1?auto=format&fit=crop&w=700&q=85",
};

const category = (slug: string) => demoCategories.find((item) => item.slug === slug) ?? null;

export const demoProducts: Product[] = [
  { id: "demo-olive-oil", name: "Aceite de oliva extra virgen", brand: "O33", quantity: 1, unit: "L", image_url: images.oliveOil, category: category("almacen"), created_at: "2026-08-28T09:00:00Z", current_price: 780, best_store: "Disco" },
  { id: "demo-coffee", name: "Café tostado molido clásico", brand: "El Chaná", quantity: 250, unit: "g", image_url: images.coffee, category: category("almacen"), created_at: "2026-08-27T09:00:00Z", current_price: 289, best_store: "Ta-Ta" },
  { id: "demo-milk", name: "Leche entera larga vida", brand: "Conaprole", quantity: 1, unit: "L", image_url: images.milk, category: category("lacteos"), created_at: "2026-08-26T09:00:00Z", current_price: 64, best_store: "Tienda Inglesa" },
  { id: "demo-pasta", name: "Fideos tirabuzón de trigo duro", brand: "Adria", quantity: 500, unit: "g", image_url: images.pasta, category: category("almacen"), created_at: "2026-08-25T09:00:00Z", current_price: 79, best_store: "Disco" },
  { id: "demo-detergent", name: "Detergente para ropa concentrado", brand: "Skip", quantity: 3, unit: "L", image_url: images.detergent, category: category("limpieza"), created_at: "2026-08-24T09:00:00Z", current_price: 498, best_store: "Ta-Ta" },
  { id: "demo-yerba", name: "Yerba mate suave", brand: "Canarias", quantity: 1, unit: "kg", image_url: images.yerba, category: category("almacen"), created_at: "2026-08-23T09:00:00Z", current_price: 239, best_store: "Tienda Inglesa" },
  { id: "demo-shampoo", name: "Shampoo hidratación diaria", brand: "Pantene", quantity: 400, unit: "ml", image_url: images.shampoo, category: category("cuidado-personal"), created_at: "2026-08-22T09:00:00Z", current_price: 319, best_store: "Disco" },
  { id: "demo-cereal", name: "Cereal de avena y miel", brand: "Nestlé", quantity: 330, unit: "g", image_url: images.cereal, category: category("almacen"), created_at: "2026-08-21T09:00:00Z", current_price: 215, best_store: "Ta-Ta" },
  { id: "demo-rice", name: "Arroz largo fino", brand: "El País", quantity: 1, unit: "kg", image_url: images.pasta, category: category("almacen"), created_at: "2026-08-20T09:00:00Z", current_price: 89, best_store: "Disco" },
  { id: "demo-soda", name: "Agua mineral sin gas", brand: "Salus", quantity: 1.5, unit: "L", image_url: images.milk, category: category("bebidas"), created_at: "2026-08-19T09:00:00Z", current_price: 72, best_store: "Tienda Inglesa" },
  { id: "demo-yogurt", name: "Yogur natural con frutilla", brand: "Conaprole", quantity: 1, unit: "kg", image_url: images.cereal, category: category("lacteos"), created_at: "2026-08-18T09:00:00Z", current_price: 198, best_store: "Ta-Ta" },
  { id: "demo-floor-cleaner", name: "Limpiador de pisos lavanda", brand: "Ala", quantity: 900, unit: "ml", image_url: images.detergent, category: category("limpieza"), created_at: "2026-08-17T09:00:00Z", current_price: 169, best_store: "Disco" },
  { id: "demo-toothpaste", name: "Crema dental protección total", brand: "Colgate", quantity: 90, unit: "g", image_url: images.shampoo, category: category("cuidado-personal"), created_at: "2026-08-16T09:00:00Z", current_price: 154, best_store: "Tienda Inglesa" },
];

export const demoStats: HomepageStats = { products: 13, stores: 3, observations: 612, days: 14 };

function suggestionLinks(suggestionId: string, urls: Array<string | null>): ProductSuggestionLink[] {
  return demoStores.map((store, index) => ({
    id: `demo-link-${suggestionId}-${store.slug}`,
    suggestion_id: suggestionId,
    store_id: store.id,
    url: urls[index] ?? "",
    store,
  }));
}

export const demoSuggestions: ProductSuggestion[] = [
  {
    id: "demo-suggestion-yerba",
    title: "Yerba mate suave Canarias 1 kg",
    category_id: "category-almacen",
    quantity: 1,
    unit: "kg",
    category: category("almacen")!,
    status: "pending",
    created_at: "2026-08-29T10:00:00Z",
    updated_at: "2026-08-29T10:00:00Z",
    reviewed_at: null,
    links: suggestionLinks("yerba", [
      "https://www.disco.com.uy/yerba-canarias",
      "https://www.tiendainglesa.com.uy/yerba-canarias",
      "https://www.tata.com.uy/yerba-canarias",
    ]),
    tags: [],
  },
  {
    id: "demo-suggestion-coffee",
    title: "Café tostado molido clásico 250 g",
    category_id: "category-almacen",
    quantity: 250,
    unit: "g",
    category: category("almacen")!,
    status: "approved",
    created_at: "2026-08-27T14:30:00Z",
    updated_at: "2026-08-28T09:15:00Z",
    reviewed_at: "2026-08-28T09:15:00Z",
    links: suggestionLinks("coffee", [
      "https://www.disco.com.uy/cafe-clasico",
      "https://www.tiendainglesa.com.uy/cafe-clasico",
      "https://www.tata.com.uy/cafe-clasico",
    ]),
    tags: [demoTags[0]],
  },
  {
    id: "demo-suggestion-detergent",
    title: "Detergente concentrado Skip 3 L",
    category_id: "category-limpieza",
    quantity: 3,
    unit: "L",
    category: category("limpieza")!,
    status: "rejected",
    created_at: "2026-08-24T11:45:00Z",
    updated_at: "2026-08-25T16:20:00Z",
    reviewed_at: "2026-08-25T16:20:00Z",
    links: suggestionLinks("detergent", [
      "https://www.disco.com.uy/skip-concentrado",
      null,
      "https://www.tata.com.uy/skip-concentrado",
    ]),
    tags: [demoTags[2]],
  },
];

export const demoSuggestionStats: AdminSuggestionStats = { pending: 1, approved: 1, rejected: 1, total: 3 };

const dates = ["2026-08-22", "2026-08-23", "2026-08-24", "2026-08-25", "2026-08-26", "2026-08-27", "2026-08-28"];
const storeFactor: Record<string, number[]> = {
  disco: [1.02, 1.01, 1.03, 1, 0.98, 0.97, 0.96],
  "tienda-inglesa": [1.08, 1.06, 1.04, 1.03, 1.01, 1, 1.02],
  "ta-ta": [1.04, 1.03, 1.01, 1.02, 1.01, 0.99, 0.98],
};

const basePrice = 820;

export const demoLatestPrices: LatestPrice[] = demoStores.map((store, index) => ({
  store_product_id: `demo-store-product-${store.slug}`,
  product_id: "demo-olive-oil",
  store_id: store.id,
  store_name: store.name,
  store_slug: store.slug,
  location_id: "demo-montevideo",
  location_name: "Montevideo",
  url: "https://www.disco.com.uy/",
  price: [780, 842, 798][index],
  date: "2026-08-28",
  scraped_at: "2026-08-28T07:10:00Z",
}));

export const demoAveragePrices: AveragePrice[] = dates.map((date, index) => ({
  product_id: "demo-olive-oil",
  date,
  average_price: Math.round(basePrice * [1.08, 1.07, 1.05, 1.03, 1.01, .99, .98][index]),
  observation_count: 3,
}));

export const demoStorePrices: StorePrice[] = demoStores.flatMap((store) => dates.map((date, index) => ({
  product_id: "demo-olive-oil",
  store_id: store.id,
  store_name: store.name,
  store_slug: store.slug,
  date,
  price: Math.round(basePrice * storeFactor[store.slug][index]),
  observation_count: 1,
})));

export function getDemoProductPageData(id: string): ProductPageData {
  const product = demoProducts.find((item) => item.id === id);
  if (!product) return { product: null, latestPrices: [], averagePrices: [], storePrices: [] };
  if (product.id === "demo-olive-oil") return { product, latestPrices: demoLatestPrices, averagePrices: demoAveragePrices, storePrices: demoStorePrices };
  const current = product.current_price ?? 0;
  const latestPrices = demoStores.map((store, index) => ({
    store_product_id: `demo-${product.id}-${store.slug}`,
    product_id: product.id,
    store_id: store.id,
    store_name: store.name,
    store_slug: store.slug,
    location_id: "demo-montevideo",
    location_name: "Montevideo",
    url: "https://www.disco.com.uy/",
    price: Math.round(current * [1, 1.08, .96][index]),
    date: "2026-08-28",
    scraped_at: "2026-08-28T07:10:00Z",
  }));
  const averagePrices = dates.map((date, index) => ({ product_id: product.id, date, average_price: Math.round(current * [1.09, 1.06, 1.05, 1.03, 1.01, 1, .98][index]), observation_count: 3 }));
  const storePrices = demoStores.flatMap((store, storeIndex) => dates.map((date, index) => ({ product_id: product.id, store_id: store.id, store_name: store.name, store_slug: store.slug, date, price: Math.round(current * [1, 1.08, .96][storeIndex] * [1.08, 1.06, 1.04, 1.03, 1.01, 1, .98][index]), observation_count: 1 })));
  return { product, latestPrices, averagePrices, storePrices };
}
