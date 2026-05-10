const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {}
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  role: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  role: "consumer" | "business_buyer" | "seller";
  phone?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    request<{ id: string; email: string; role: string }>(
      "/v1/auth/register",
      { method: "POST", body: JSON.stringify(payload) }
    ),

  login: (payload: LoginPayload) =>
    request<TokenResponse>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  refresh: (refresh_token: string) =>
    request<TokenResponse>("/v1/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),

  logout: (refresh_token: string) =>
    request<void>("/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refresh_token }),
    }),
};

// ── Products (public) ─────────────────────────────────────────────────────────

export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_price: number | null;
  stock_qty: number;
  avg_rating: number | null;
  review_count: number;
  is_b2b_eligible: boolean;
  images: { id: string; url: string; alt: string | null; is_primary: boolean }[];
  seller: { id: string; display_name: string; slug: string };
}

export interface ProductListResponse {
  items: ApiProduct[];
  total: number;
  page: number;
  size: number;
}

export const productsApi = {
  list: (params?: {
    page?: number;
    size?: number;
    category_id?: string;
    search?: string;
    min_price?: number;
    max_price?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.size) qs.set("size", String(params.size));
    if (params?.category_id) qs.set("category_id", params.category_id);
    if (params?.search) qs.set("q", params.search);
    if (params?.min_price != null) qs.set("min_price", String(params.min_price));
    if (params?.max_price != null) qs.set("max_price", String(params.max_price));
    return request<ProductListResponse>(`/v1/products?${qs}`);
  },

  get: (slug: string) => request<ApiProduct>(`/v1/products/${slug}`),
};

// ── Reviews ───────────────────────────────────────────────────────────────────

export interface ReviewResponse {
  id: string;
  order_id: string | null;
  product_id: string | null;
  buyer_id: string | null;
  rating: number;
  title: string | null;
  body: string | null;
  helpful_count: number;
  created_at: string;
}

export interface PaginatedReviews {
  items: ReviewResponse[];
  total: number;
  page: number;
  pages: number;
}

export const reviewsApi = {
  list: (productId: string, page = 1) =>
    request<PaginatedReviews>(
      `/v1/products/${productId}/reviews?page=${page}&limit=10`
    ),

  create: (
    token: string,
    payload: {
      order_id: string;
      product_id: string;
      rating: number;
      body: string;
      title?: string;
    }
  ) =>
    request<ReviewResponse>(
      "/v1/reviews",
      { method: "POST", body: JSON.stringify(payload) },
      token
    ),
};
