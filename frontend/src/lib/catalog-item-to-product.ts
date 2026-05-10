import { CatalogListItem } from "./api";
import { Product } from "@/types";

export function catalogItemToProduct(
  item: CatalogListItem,
  seller: { id: string; display_name: string; slug: string }
): Product {
  return {
    id: item.id,
    name: item.title,
    slug: item.slug,
    price: item.min_price ?? 0,
    compare_price: null,
    stock_qty: 1,
    avg_rating: null,
    review_count: 0,
    is_b2b_eligible: item.is_b2b_eligible,
    images: [
      {
        id: "placeholder",
        url: `https://placehold.co/400x400/e5e7eb/9ca3af?text=${encodeURIComponent(
          item.title.slice(0, 12)
        )}`,
        alt: item.title,
        is_primary: true,
      },
    ],
    seller,
  };
}
