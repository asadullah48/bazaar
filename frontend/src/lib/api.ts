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

// ── Admin ────────────────────────────────────────────────────────────────────

export interface AdminSellerItem {
  id: string;
  store_name: string;
  email: string;
  status: string;
  created_at: string;
}

export interface AdminPaginatedSellers {
  items: AdminSellerItem[];
  total: number;
  page: number;
  pages: number;
}

export interface AdminProductListItem {
  id: string;
  title: string;
  status: string;
  seller_id: string;
  seller_store_name: string | null;
  seller_email: string;
  created_at: string;
}

export interface AdminProductDetail {
  id: string;
  title: string;
  status: string;
  rejection_reason: string | null;
  seller_id: string;
  created_at: string;
}

export interface AdminPaginatedProducts {
  items: AdminProductListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface PayoutRecord {
  id: string;
  seller_id: string;
  period_start: string;
  period_end: string;
  gross_amount: number;
  commission_amount: number;
  processing_fees: number;
  net_amount: number;
  status: string;
  bank_ref: string | null;
  paid_at: string | null;
  created_at: string;
  line_items: unknown[];
}

export interface PaginatedPayouts {
  items: PayoutRecord[];
  total: number;
  page: number;
  pages: number;
}

export const adminApi = {
  listSellers: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<AdminPaginatedSellers>(`/v1/admin/sellers?${qs}`, {}, token);
  },
  approveSeller: (token: string, userId: string) =>
    request<AdminSellerItem>(`/v1/admin/sellers/${userId}/approve`, { method: "PUT" }, token),
  suspendSeller: (token: string, userId: string) =>
    request<AdminSellerItem>(`/v1/admin/sellers/${userId}/suspend`, { method: "PUT" }, token),

  listProducts: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<AdminPaginatedProducts>(`/v1/admin/products?${qs}`, {}, token);
  },
  approveProduct: (token: string, productId: string) =>
    request<AdminProductDetail>(`/v1/admin/products/${productId}/approve`, { method: "PUT" }, token),
  rejectProduct: (token: string, productId: string, reason: string) =>
    request<AdminProductDetail>(
      `/v1/admin/products/${productId}/reject`,
      { method: "PUT", body: JSON.stringify({ reason }) },
      token
    ),

  listPayouts: (token: string, params?: { status?: string; page?: number; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    return request<PaginatedPayouts>(`/v1/admin/payouts?${qs}`, {}, token);
  },
  markPayoutPaid: (token: string, payoutId: string, bankRef: string) =>
    request<PayoutRecord>(
      `/v1/admin/payouts/${payoutId}/mark-paid`,
      { method: "PUT", body: JSON.stringify({ bank_ref: bankRef }) },
      token
    ),
};
