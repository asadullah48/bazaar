import Link from "next/link";
import { productsApi, searchApi } from "@/lib/api";
import { ProductCard } from "@/components/product/product-card";
import { toProduct } from "@/lib/to-product";

export async function CatalogResults({ locale, values }: { locale: string; values: Record<string, string | undefined> }) {
  const ar = locale === "ar";
  const ur = locale === "ur";
  const text = (en: string, arabic: string, urdu: string) => ar ? arabic : ur ? urdu : en;
  const page = Math.max(1, Number.parseInt(values.page || "1") || 1);
  const filters = new URLSearchParams();
  for (const key of ["category_id", "min_price", "max_price", "is_b2b", "sort"]) if (values[key]) filters.set(key, values[key]!);
  if (["min_price", "max_price"].some(k => values[k] && (!Number.isFinite(Number(values[k])) || Number(values[k]) < 0)) || (values.min_price && values.max_price && Number(values.min_price) > Number(values.max_price))) return <p role="alert">{text("Enter a valid price range, with minimum below maximum.", "أدخل نطاق سعر صالحاً، الحد الأدنى أقل من الأعلى.", "درست قیمت کی حد درج کریں۔")}</p>;
  let result;
  try {
    if (values.q?.trim()) result = await searchApi.search(values.q.trim().slice(0, 200), page, filters);
    else result = await productsApi.catalog(page, filters);
  } catch {
    return <div role="alert" className="rounded-xl border p-8"><p>{text("Products are unavailable. Please try again.", "المنتجات غير متاحة. حاول مرة أخرى.", "مصنوعات دستیاب نہیں۔ دوبارہ کوشش کریں۔")}</p><Link href={`/${locale}/products`} className="underline">{text("Browse products", "تصفح المنتجات", "مصنوعات دیکھیں")}</Link></div>;
  }
  const products = await Promise.all(result.items.filter(i => i.slug).map(i => productsApi.get(i.slug!).catch(() => null)));
  return <div className="space-y-6">
    <p role="status">{result.total} {text(result.total === 1 ? "result" : "results", "نتيجة", "نتائج")}</p>
    <h2 className="sr-only">{text("Product results", "نتائج المنتجات", "مصنوعات کے نتائج")}</h2>
    {!result.items.length ? <div className="rounded-xl border p-10 text-center"><h2 className="text-xl font-semibold">{text("No matching products", "لا توجد منتجات مطابقة", "کوئی مصنوعات نہیں ملیں")}</h2><p className="my-3">{text("Try another search or remove a filter.", "جرّب بحثاً آخر أو أزل أحد الفلاتر.", "دوبارہ تلاش کریں یا فلٹر ہٹائیں۔")}</p><Link href={`/${locale}/products`} className="underline">{text("Clear filters", "مسح الفلاتر", "فلٹر صاف کریں")}</Link></div> : <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{products.map((p, i) => p ? <ProductCard key={p.id} product={toProduct(p)} locale={locale} /> : <p key={i}>{text("Product unavailable", "المنتج غير متاح", "مصنوعہ دستیاب نہیں")}</p>)}</div>}
    <nav aria-label={text("Pagination", "الصفحات", "صفحات")} className="flex justify-center gap-6">
      {[page - 1, page + 1].filter(p => p >= 1 && p <= result.pages).map(p => { const qs = new URLSearchParams(filters); if (values.q) qs.set("q", values.q); qs.set("page", String(p)); return <Link key={p} className="underline p-3" href={`/${locale}/products?${qs}`}>{p < page ? text("Previous", "السابق", "پچھلا") : text("Next", "التالي", "اگلا")}</Link>; })}
    </nav>
  </div>;
}
