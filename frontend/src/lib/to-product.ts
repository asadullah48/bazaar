import { ApiProduct } from "./api";
import { Product } from "@/types";

export function toProduct(p: ApiProduct): Product {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    price: p.price,
    compare_price: p.compare_price,
    stock_qty: p.stock_qty,
    avg_rating: p.avg_rating,
    review_count: p.review_count,
    is_b2b_eligible: p.is_b2b_eligible,
    images:
      p.images.length > 0
        ? p.images
        : [
            {
              id: "placeholder",
              url: `https://placehold.co/400x400/e5e7eb/9ca3af?text=${encodeURIComponent(p.name.slice(0, 12))}`,
              alt: p.name,
              is_primary: true,
            },
          ],
    seller: p.seller,
  };
}
