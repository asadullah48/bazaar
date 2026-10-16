import Link from "next/link";
import { Suspense } from "react";
import { CatalogResults } from "@/components/catalog-results";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
export default async function Home({params}: {params: Promise<{locale:string}>}) {
 const {locale} = await params;
 const text = (en:string, ar:string, ur:string) => locale === "ar" ? ar : locale === "ur" ? ur : en;
 return <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
  <section className="rounded-2xl border border-orange-200 bg-orange-50 dark:bg-gray-900 p-6 sm:p-10">
   <p className="text-cyan-800 dark:text-cyan-300 font-semibold mb-3">Bazaar · {text("Retail & wholesale", "تجزئة وجملة", "پرچون اور تھوک")}</p>
   <h1 className="text-3xl sm:text-5xl font-bold max-w-2xl leading-tight">{text("Find what you need. Buy your way.", "اعثر على ما تحتاجه. تسوق بطريقتك.", "اپنی ضرورت تلاش کریں۔ اپنے انداز میں خریدیں۔")}</h1>
   <p className="mt-4 max-w-xl">{text("Explore products, compare prices and request a quote for business purchases.", "تصفح المنتجات وقارن الأسعار واطلب عرض سعر لمشتريات الأعمال.", "مصنوعات دیکھیں، قیمتوں کا موازنہ کریں اور کاروباری خریداری کے لیے نرخ مانگیں۔")}</p>
   <div className="flex flex-wrap gap-3 mt-6"><Link className="market-button" href={`/${locale}/products`}>{text("Browse products", "تصفح المنتجات", "مصنوعات دیکھیں")}</Link><Link className="rounded-lg border border-cyan-700 p-3" href={`/${locale}/rfq/new`}>{text("Request a quote", "طلب عرض سعر", "نرخ طلب کریں")}</Link></div>
  </section>
  <section><h2 className="text-2xl font-bold mb-5">{text("Explore the catalog", "استكشف المنتجات", "مصنوعات تلاش کریں")}</h2><Suspense fallback={<ProductGridSkeleton count={8}/>}><CatalogResults locale={locale} values={{}}/></Suspense></section>
  <aside className="rounded-xl border p-5 text-sm leading-relaxed">{text("Payment integration status: JazzCash and Easypaisa adapters default to sandbox. Card integration is partial. Successful sandbox transactions and live merchant processing are unverified.", "حالة الدفع: تكامل JazzCash وEasypaisa افتراضيًا في بيئة اختبار. تكامل البطاقة جزئي. نجاح المعاملات التجريبية والتشغيل الفعلي غير مؤكد.", "ادائیگی: JazzCash اور Easypaisa سینڈباکس پر مبنی ہیں۔ کارڈ انضمام جزوی ہے۔ کامیاب آزمائشی لین دین اور لائیو ادائیگیاں غیر تصدیق شدہ ہیں۔")}</aside>
 </div>;
}
