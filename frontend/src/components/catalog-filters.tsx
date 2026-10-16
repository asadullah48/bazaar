import { categoriesApi } from "@/lib/api";

export async function CatalogFilters({ locale, values }: { locale: string; values: Record<string, string | undefined> }) {
  const rtl = locale !== "en";
  const ar = locale === "ar";
  const text = (en: string, arabic: string, ur: string) => ar ? arabic : rtl ? ur : en;
  const categories = await categoriesApi.tree().catch(() => []);
  return <form className="grid gap-4 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 sm:grid-cols-2 lg:grid-cols-6" role="search">
    <label className="text-sm">{text("Search", "بحث", "تلاش")}<input name="q" defaultValue={values.q} type="search" className="market-input" /></label>
    <label className="text-sm">{text("Category", "الفئة", "زمرہ")}<select name="category_id" defaultValue={values.category_id} className="market-input"><option value="">{text("All categories", "كل الفئات", "تمام زمرے")}</option>{categories.flatMap(c => [c, ...c.children]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label className="text-sm">{text("Minimum price (PKR)", "أقل سعر (PKR)", "کم از کم قیمت (PKR)")}<input name="min_price" type="number" min="0" step="0.01" defaultValue={values.min_price} className="market-input" /></label>
    <label className="text-sm">{text("Maximum price (PKR)", "أعلى سعر (PKR)", "زیادہ سے زیادہ قیمت (PKR)")}<input name="max_price" type="number" min="0" step="0.01" defaultValue={values.max_price} className="market-input" /></label>
    <label className="text-sm">{text("Buying mode", "نوع الشراء", "خریداری کی قسم")}<select name="is_b2b" defaultValue={values.is_b2b} className="market-input"><option value="">{text("All products", "كل المنتجات", "تمام مصنوعات")}</option><option value="true">{text("Wholesale eligible", "متاح للجملة", "تھوک دستیاب")}</option><option value="false">{text("Retail only", "تجزئة فقط", "صرف پرچون")}</option></select></label>
    <label className="text-sm">{text("Sort", "ترتيب", "ترتیب")}<select name="sort" defaultValue={values.sort} className="market-input"><option value="newest">{text("Newest", "الأحدث", "تازہ ترین")}</option><option value="price_asc">{text("Price: low to high", "السعر: تصاعدي", "قیمت: کم سے زیادہ")}</option><option value="price_desc">{text("Price: high to low", "السعر: تنازلي", "قیمت: زیادہ سے کم")}</option></select></label>
    <button className="market-button sm:col-span-2 lg:col-span-6">{text("Apply filters", "تطبيق الفلاتر", "فلٹر لگائیں")}</button>
  </form>;
}
