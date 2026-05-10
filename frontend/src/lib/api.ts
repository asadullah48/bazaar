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

// ── User ──────────────────────────────────────────────────────────────────────

export interface UserMe {
  id: string;
  email: string;
  role: string;
  phone: string | null;
  phone_verified: boolean;
}

export interface UserMeUpdate {
  full_name?: string;
  phone?: string;
}

export const usersApi = {
  me: (token: string) => request<UserMe>("/v1/users/me", {}, token),
  updateMe: (token: string, data: UserMeUpdate) =>
    request<UserMe>("/v1/users/me", { method: "PUT", body: JSON.stringify(data) }, token),
};

// ── Addresses ─────────────────────────────────────────────────────────────────

export interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  province: string | null;
  postal_code: string | null;
  label: string | null;
  is_default: boolean;
  created_at: string;
}

export interface AddressPayload {
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  province?: string;
  postal_code?: string;
  label?: string;
  is_default?: boolean;
}

export const addressesApi = {
  list: (token: string) =>
    request<Address[]>("/v1/users/me/addresses", {}, token),
  create: (token: string, data: AddressPayload) =>
    request<Address>("/v1/users/me/addresses", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
  setDefault: (token: string, id: string) =>
    request<Address>(`/v1/users/me/addresses/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_default: true }),
    }, token),
  delete: (token: string, id: string) =>
    request<void>(`/v1/users/me/addresses/${id}`, { method: "DELETE" }, token),
};

// ── Sellers ───────────────────────────────────────────────────────────────────

export interface CatalogListItem {
  id: string;
  title: string;
  slug: string;
  brand: string | null;
  condition: string;
  min_price: number | null;
  is_b2b_eligible: boolean;
  seller_id: string;
  category_id: string | null;
  created_at: string;
}

export interface SellerStorefrontResponse {
  store_name: string;
  description: string | null;
  city: string | null;
  total_rating: number;
  review_count: number;
  approved_at: string | null;
  products: {
    items: CatalogListItem[];
    total: number;
    page: number;
    pages: number;
  };
}

export const sellersApi = {
  storefront: (slug: string, page = 1) =>
    request<SellerStorefrontResponse>(
      `/v1/sellers/${slug}?page=${page}&limit=16`
    ),
};

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchItem {
  id: string;
  title: string;
  slug: string | null;
  brand: string | null;
  condition: string | null;
  category_id: string | null;
  seller_id: string;
  min_price: number | null;
  is_b2b_eligible: boolean;
  created_at: string;
}

export interface SearchListResponse {
  items: SearchItem[];
  total: number;
  page: number;
  pages: number;
}

export const searchApi = {
  search: (q: string, page = 1) =>
    request<SearchListResponse>(
      `/v1/search?q=${encodeURIComponent(q)}&page=${page}&limit=20`
    ),
};
