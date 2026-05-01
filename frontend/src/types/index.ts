export interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_price?: number | null;
  currency?: string;
  stock_qty: number;
  images: ProductImage[];
  seller: {
    id: string;
    display_name: string;
    slug: string;
  };
  avg_rating?: number | null;
  review_count?: number;
  is_b2b_eligible?: boolean;
}

export interface ProductImage {
  id: string;
  url: string;
  alt?: string | null;
  is_primary: boolean;
}

export interface CartItem {
  product_id: string;
  name: string;
  slug: string;
  image_url: string;
  price: number;
  quantity: number;
  stock_qty: number;
  seller_name: string;
}
