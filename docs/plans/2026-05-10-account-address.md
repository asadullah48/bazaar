# Account Page & Address Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `/[locale]/account` — a tabbed page with Profile (view/edit email, phone) and Addresses (CRUD + set-default), backed by the real FastAPI endpoints.

**Architecture:** Single `"use client"` page with local `tab` state. All API calls go through typed helpers in `api.ts`. Auth is already guarded by the existing middleware (`/account` is in `PROTECTED`). Address set-default uses `PUT /v1/users/me/addresses/{id}` with `{ is_default: true }` — no dedicated endpoint exists.

**Tech Stack:** Next.js 14 App Router, Zustand auth store, TypeScript, Tailwind CSS.

---

## Backend shape (verified from source)

### GET/PUT `/v1/users/me`
```typescript
// Response: UserMeResponse
{ id, email, role, phone: string|null, phone_verified: bool }

// PUT body: UserMeUpdate
{ full_name?: string, phone?: string }
// NOTE: full_name updates UserProfile child row, not returned in UserMeResponse
```

### `/v1/users/me/addresses` (NOT `/v1/addresses`)
```typescript
// AddressResponse
{ id, user_id, full_name, phone, address_line1, address_line2?, city,
  province?, postal_code?, label?, is_default, created_at }

// AddressCreate (POST body)
{ full_name, phone, address_line1, address_line2?, city,
  province?, postal_code?, label?, is_default?: bool }

// AddressUpdate (PUT body) — all optional
{ full_name?, phone?, address_line1?, address_line2?, city?,
  province?, postal_code?, label?, is_default?: bool }

// Set default: PUT /v1/users/me/addresses/{address_id} with { is_default: true }
// Delete: DELETE /v1/users/me/addresses/{address_id} -> 204
```
**No `country` field. No `/set-default` endpoint.**

---

## Task 1: Create feature branch

```bash
git checkout main
git pull origin main
git checkout -b feat/account
```

---

## Task 2: Add typed API helpers to api.ts

**Files:**
- Modify: `frontend/src/lib/api.ts` (append after productsApi block)

**Step 1: Append the following to `frontend/src/lib/api.ts`**

```typescript
// -- User ---------------------------------------------------------------------

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

// -- Addresses ----------------------------------------------------------------

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
```

**Step 2: TypeScript check**

```powershell
cd D:\bazaar\frontend; npx tsc --noEmit 2>&1
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(api): add usersApi and addressesApi typed helpers"
```

---

## Task 3: Account page

**Files:**
- Create: `frontend/src/app/[locale]/account/page.tsx`

**Note on `full_name`:** The backend PUT accepts `full_name` but GET does not return it (it lives on the profile child record). The Profile tab therefore only shows/edits `email` (read-only) and `phone`.

**Step 1: Create the page**

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useAuthStore } from "@/store/auth-store";
import { usersApi, addressesApi, UserMe, Address, AddressPayload } from "@/lib/api";

export default function AccountPage() {
  const locale = useLocale();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [tab, setTab] = useState<"profile" | "addresses">("profile");

  // Profile state
  const [user, setUser] = useState<UserMe | null>(null);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  // Address state
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<AddressPayload>({
    full_name: "",
    phone: "",
    address_line1: "",
    city: "",
  });

  useEffect(() => {
    if (!accessToken) {
      router.push(`/${locale}/auth/login`);
      return;
    }
    usersApi.me(accessToken).then((u) => {
      setUser(u);
      setPhone(u.phone ?? "");
    });
  }, [accessToken, locale, router]);

  useEffect(() => {
    if (tab === "addresses" && accessToken) {
      setAddrLoading(true);
      addressesApi
        .list(accessToken)
        .then(setAddresses)
        .catch(() => {})
        .finally(() => setAddrLoading(false));
    }
  }, [tab, accessToken]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }

  async function saveProfile() {
    if (!accessToken) return;
    setSaving(true);
    try {
      const updated = await usersApi.updateMe(accessToken, { phone: phone || undefined });
      setUser(updated);
      showToast("Profile saved");
    } catch {
      showToast("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function createAddress() {
    if (!accessToken) return;
    try {
      const addr = await addressesApi.create(accessToken, form);
      setAddresses((prev) => [...prev, addr]);
      setShowForm(false);
      setForm({ full_name: "", phone: "", address_line1: "", city: "" });
    } catch {
      showToast("Failed to add address");
    }
  }

  async function setDefault(id: string) {
    if (!accessToken) return;
    try {
      const updated = await addressesApi.setDefault(accessToken, id);
      setAddresses((prev) =>
        prev.map((a) => ({ ...a, is_default: a.id === updated.id }))
      );
    } catch {
      showToast("Failed to set default");
    }
  }

  async function deleteAddress(id: string) {
    if (!accessToken) return;
    if (!confirm("Delete this address?")) return;
    setDeleting(id);
    try {
      await addressesApi.delete(accessToken, id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
    } catch {
      showToast("Failed to delete address");
    } finally {
      setDeleting(null);
    }
  }

  const inputCls =
    "w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-400";
  const btnOrange =
    "bg-orange-500 hover:bg-orange-600 text-white font-semibold py-2 px-4 rounded-xl text-sm transition-colors";

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium px-5 py-2.5 rounded-xl shadow-lg z-50">
          {toast}
        </div>
      )}

      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        My Account
      </h1>

      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-fit">
        {(["profile", "addresses"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "profile" && user && (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
            <input value={user.email} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
            <input value={user.role} readOnly className={`${inputCls} opacity-60 cursor-not-allowed`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+92 300 0000000"
              className={inputCls}
            />
          </div>
          <button onClick={saveProfile} disabled={saving} className={btnOrange}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {tab === "addresses" && (
        <div className="space-y-4">
          {addrLoading ? (
            <p className="text-gray-400 text-sm">Loading addresses...</p>
          ) : addresses.length === 0 && !showForm ? (
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-8 text-center">
              <p className="text-gray-400 text-sm mb-3">No saved addresses.</p>
              <button onClick={() => setShowForm(true)} className={btnOrange}>Add Address</button>
            </div>
          ) : (
            <>
              {addresses.map((addr) => (
                <div key={addr.id} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{addr.full_name}</p>
                        {addr.is_default && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Default</span>
                        )}
                        {addr.label && (
                          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-full">{addr.label}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {addr.address_line1}{addr.address_line2 && `, ${addr.address_line2}`}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {addr.city}{addr.province && `, ${addr.province}`}{addr.postal_code && ` ${addr.postal_code}`}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{addr.phone}</p>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      {!addr.is_default && (
                        <button onClick={() => setDefault(addr.id)} className="text-sm text-orange-500 hover:underline">
                          Set Default
                        </button>
                      )}
                      {!addr.is_default && (
                        <button
                          onClick={() => deleteAddress(addr.id)}
                          disabled={deleting === addr.id}
                          className="text-sm text-red-400 hover:text-red-600 hover:underline"
                        >
                          {deleting === addr.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {!showForm && (
                <button
                  onClick={() => setShowForm(true)}
                  className="w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl py-4 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-500 transition-colors"
                >
                  + Add New Address
                </button>
              )}
            </>
          )}

          {showForm && (
            <div className="bg-white dark:bg-gray-900 border border-orange-200 dark:border-orange-900 rounded-2xl p-5 space-y-3">
              <h2 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">New Address</h2>
              {(
                [
                  ["label", "Label (e.g. Home, Office)", false],
                  ["full_name", "Full Name", true],
                  ["phone", "Phone", true],
                  ["address_line1", "Address Line 1", true],
                  ["address_line2", "Address Line 2", false],
                  ["city", "City", true],
                  ["province", "Province", false],
                  ["postal_code", "Postal Code", false],
                ] as [keyof AddressPayload, string, boolean][]
              ).map(([field, placeholder, required]) => (
                <input
                  key={field}
                  placeholder={placeholder + (required ? " *" : "")}
                  value={(form[field] as string) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                  className={inputCls}
                />
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={createAddress}
                  disabled={!form.full_name || !form.phone || !form.address_line1 || !form.city}
                  className={`${btnOrange} disabled:opacity-40`}
                >
                  Save Address
                </button>
                <button onClick={() => setShowForm(false)} className="text-sm text-gray-400 hover:text-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: TypeScript check**

```powershell
cd D:\bazaar\frontend; npx tsc --noEmit 2>&1
```

Expected: zero errors.

**Step 3: Commit**

```bash
git add "frontend/src/app/[locale]/account/page.tsx"
git commit -m "feat(frontend): account page — profile view/edit + address CRUD"
```

---

## Task 4: Verify header account + orders links

**Files:**
- Read then maybe modify: `frontend/src/components/header.tsx`

**Step 1: Check account link target**

```bash
grep -n "account\|orders\|Orders" frontend/src/components/header.tsx
```

The user icon should link to `/${locale}/account`.
The authenticated dropdown should have a "My Orders" link to `/${locale}/orders`.

**Step 2: Update header if needed**

If "My Orders" link is missing from the authenticated dropdown, add it near the Sign Out button.

**Step 3: Commit only if changed**

```bash
git add frontend/src/components/header.tsx
git commit -m "fix(header): ensure account link + My Orders in user dropdown"
```

---

## Task 5: Final verification & PR

**Step 1: Full TypeScript check**

```powershell
cd D:\bazaar\frontend; npx tsc --noEmit 2>&1
```

Expected: zero errors.

**Step 2: Manual smoke test**

1. Visit `/en/account` logged out → redirected to `/en/auth/login`
2. Log in → `/en/account` loads, Profile tab shows email + phone
3. Edit phone → Save → toast "Profile saved" appears
4. Switch to Addresses → "No saved addresses"
5. Add address with required fields → appears in list
6. Add second address → "Set Default" → badge moves
7. Delete non-default address → confirm → disappears

**Step 3: Push and open PR**

```powershell
git push origin feat/account

$body = @'
## Summary
- usersApi.me / updateMe typed to GET|PUT /v1/users/me
- addressesApi: list, create, setDefault (via PUT is_default:true), delete
- /[locale]/account: tabbed page — Profile (email/phone) + Addresses (CRUD + default)
- SSR-guarded via existing middleware (/account already in PROTECTED list)

## Backend shape corrections vs spec
- Address routes: /v1/users/me/addresses not /v1/addresses
- No /set-default endpoint — uses PUT with { is_default: true }
- UserMeResponse has no nested profile/bio — only id, email, role, phone, phone_verified
- No country field in addresses

## Test plan
- [ ] Unauthenticated /account redirects to /auth/login
- [ ] Profile tab: email read-only, phone editable, save shows toast
- [ ] Addresses tab: add address, set default, delete non-default
- [ ] npx tsc --noEmit passes with zero errors
'@
gh pr create --title "feat(frontend): account page with profile edit + address management" --body $body --base main
```
