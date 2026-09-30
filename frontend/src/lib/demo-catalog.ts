import type { ApiProduct, CategoryNode, CatalogListItem } from "./api";

export const DEMO_CATEGORIES: CategoryNode[] = [
  ["textiles", "Textiles & Fashion"], ["electronics", "Electronics"],
  ["furniture", "Furniture"], ["kitchen", "Kitchen & Home"],
  ["auto-parts", "Auto Parts"], ["tools", "Tools & Hardware"],
].map(([slug, name]) => ({ id: slug, slug, name, icon_url: null, children: [] }));

const rows: [string, string, number, string, string, string, number][] = [
  ["embroidered-lawn", "Embroidered lawn · three-piece suit", 4200, "textiles", "Lahore Textile Studio", "Lahore", 180],
  ["cotton-bedlinen", "Cotton bed linen · queen set", 3600, "textiles", "Lahore Textile Studio", "Lahore", 240],
  ["linen-fabric", "Natural linen · fabric bundle", 1800, "textiles", "Lahore Textile Studio", "Lahore", 320],
  ["wireless-headphones", "Wireless headphones · everyday audio", 5800, "electronics", "Karachi Tech Collective", "Karachi", 64],
  ["desk-lamp", "Adjustable LED desk lamp", 2900, "electronics", "Karachi Tech Collective", "Karachi", 92],
  ["oak-side-table", "Oak finish · compact side table", 12500, "furniture", "Craft House", "Islamabad", 28],
  ["accent-chair", "Woven accent chair", 24000, "furniture", "Craft House", "Islamabad", 16],
  ["ceramic-dinnerware", "Ceramic dinnerware · six-piece set", 4800, "kitchen", "Home Essentials", "Faisalabad", 150],
  ["steel-cookware", "Stainless steel cookware · starter set", 8900, "kitchen", "Home Essentials", "Faisalabad", 75],
  ["car-care-kit", "Car care · detailing kit", 3200, "auto-parts", "Workshop Supply", "Rawalpindi", 120],
  ["socket-toolkit", "Socket toolkit · workshop essentials", 6500, "tools", "Workshop Supply", "Rawalpindi", 88],
  ["cordless-drill", "Cordless drill · home project kit", 14500, "tools", "Workshop Supply", "Rawalpindi", 42],
];

export type DemoProduct = ApiProduct & { category: string; city: string; description: string; moq: number };
export const DEMO_PRODUCTS: DemoProduct[] = rows.map(([slug, name, price, category, seller, city, stock], index) => ({
  id: `demo-product-${index + 1}`, slug, name, price, compare_price: null,
  stock_qty: stock, avg_rating: null, review_count: 0, is_b2b_eligible: true,
  images: [{ id: `demo-image-${index + 1}`, url: `/demo/${slug}.svg`, alt: `${name} — illustrative sample`, is_primary: true }],
  seller: { id: `demo-seller-${seller}`, display_name: seller, slug: seller.toLowerCase().replaceAll(" ", "-") },
  category, city, moq: category === "furniture" ? 5 : 20,
  description: `A sample ${category.replaceAll("-", " ")} listing from ${city}. Explore retail shopping or use the sourcing workbench to compare illustrative wholesale terms. Product artwork, availability, prices and suppliers are demonstration data.`,
}));

export function filterDemoProducts(params: URLSearchParams) {
  const q = (params.get("q") ?? "").toLowerCase().trim();
  const category = params.get("category_id");
  const min = Number(params.get("min_price") ?? 0);
  const max = Number(params.get("max_price") ?? Infinity);
  return DEMO_PRODUCTS.filter(p => (!q || `${p.name} ${p.category} ${p.city} ${p.seller.display_name}`.toLowerCase().includes(q)) &&
    (!category || p.category === category) && p.price >= min && p.price <= max);
}

export function catalogItem(p: DemoProduct): CatalogListItem {
  return { id: p.id, title: p.name, slug: p.slug, brand: null, condition: "new", min_price: p.price,
    is_b2b_eligible: true, seller_id: p.seller.id, category_id: p.category, created_at: "2026-01-01T00:00:00Z" };
}

export function demoResponse(path: string, method = "GET"): Response {
  const url = new URL(path, "https://demo.invalid");
  const route = url.pathname;
  const json = (data: unknown, status = 200) => Response.json(data, { status });
  if (method !== "GET") return json({ detail: "This is a portfolio demo. Account creation, real orders, AI calls and payments are disabled. Explore the demo workbench instead." }, 503);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const size = Math.min(50, Math.max(1, Number(url.searchParams.get("size") ?? url.searchParams.get("limit")) || 16));
  if (route === "/v1/products" || route === "/v1/search") {
    const all = filterDemoProducts(url.searchParams);
    const items = all.slice((page - 1) * size, page * size);
    return json({ items: route === "/v1/search" ? items.map(catalogItem) : items, total: all.length, page, size, pages: Math.ceil(all.length / size) });
  }
  if (route === "/v1/categories") return json(DEMO_CATEGORIES);
  if (/^\/v1\/products\/[^/]+\/reviews$/.test(route)) return json({ items: [], total: 0, page, pages: 0 });
  if (/^\/v1\/products\/[^/]+\/qr$/.test(route)) return json({ detail: "No sample QR" }, 404);
  if (route.startsWith("/v1/products/")) {
    const p = DEMO_PRODUCTS.find(p => p.slug === decodeURIComponent(route.split("/")[3]));
    return p ? json(p) : json({ detail: "Product not found" }, 404);
  }
  if (route.startsWith("/v1/sellers/")) {
    const items = DEMO_PRODUCTS.filter(p => p.seller.slug === route.split("/")[3]);
    return items.length ? json({ store_name: items[0].seller.display_name, city: items[0].city, description: "Illustrative supplier profile. No real seller verification is claimed.", total_rating: 0, review_count: 0, approved_at: null,
      products: { items: items.map(catalogItem), total: items.length, page: 1, pages: 1 } }) : json({ detail: "Seller not found" }, 404);
  }
  if (route === "/v1/recommendations") return json({ items: DEMO_PRODUCTS.filter(p => p.id !== url.searchParams.get("product_id")).slice(0, 4).map(p => ({ id: p.id, title: p.name, slug: p.slug, price: p.price, image_url: p.images[0].url })) });
  if (route === "/v1/slots/flash") return json({ items: [] });
  return json({ detail: "Explore this workflow in the demo workbench." }, 503);
}
