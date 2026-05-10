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

// ── Seller Products ──────────────────────────────────────────────────────────

export interface SellerProductListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  category_id: string | null;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  sku_code: string;
  price: number;
  sale_price: number | null;
  stock_qty: number;
  is_active: boolean;
  option1_name: string | null;
  option1_value: string | null;
  option2_name: string | null;
  option2_value: string | null;
}

export interface SellerProduct {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  status: string;
  is_b2b_eligible: boolean;
  b2b_moq: number | null;
  attributes: Record<string, unknown>;
  variants: ProductVariant[];
  images: { id: string; url: string; alt: string | null; is_primary: boolean }[];
  created_at: string;
}

export interface VariantCreate {
  price: number;
  stock_qty: number;
  sku_code: string;
  sale_price?: number;
  option1_name?: string;
  option1_value?: string;
  option2_name?: string;
  option2_value?: string;
}

export interface ProductCreate {
  title: string;
  slug: string;
  description?: string;
  category_id?: string;
  is_b2b_eligible?: boolean;
  b2b_moq?: number;
  variants: VariantCreate[];
}

export const sellerProductsApi = {
  list: (token: string, params?: { page?: number; size?: number }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.size) qs.set("size", String(params.size));
    return request<{ items: SellerProductListItem[]; total: number; page: number; size: number }>(
      `/v1/seller/products?${qs}`,
      {},
      token
    );
  },
  get: (token: string, id: string) =>
    request<SellerProduct>(`/v1/seller/products/${id}`, {}, token),
  create: (token: string, data: ProductCreate) =>
    request<SellerProduct>("/v1/seller/products", { method: "POST", body: JSON.stringify(data) }, token),
  publish: (token: string, id: string) =>
    request<SellerProduct>(`/v1/seller/products/${id}/publish`, { method: "PUT" }, token),
  archive: (token: string, id: string) =>
    request<SellerProduct>(`/v1/seller/products/${id}`, { method: "DELETE" }, token),
};

// ── Categories ───────────────────────────────────────────────────────────────

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
  children: CategoryNode[];
}

export const categoriesApi = {
  tree: () => request<CategoryNode[]>("/v1/categories"),
};
