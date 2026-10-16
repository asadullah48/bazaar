import { Suspense } from "react";
import { CatalogFilters } from "@/components/catalog-filters";
import { CatalogResults } from "@/components/catalog-results";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
export default async function ProductsPage({ params, searchParams }: { params: Promise<{locale: string}>; searchParams: Promise<Record<string,string | undefined>> }) {
  const {locale} = await params; const values = await searchParams;
  return <div className="max-w-7xl mx-auto px-4 py-8"><h1 className="text-2xl font-bold mb-6">{locale === "ar" ? "تسوق المنتجات" : locale === "ur" ? "مصنوعات خریدیں" : "Shop products"}</h1><CatalogFilters locale={locale} values={values}/><Suspense key={JSON.stringify(values)} fallback={<ProductGridSkeleton count={8}/>}><CatalogResults locale={locale} values={values}/></Suspense></div>;
}
