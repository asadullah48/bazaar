import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, ShoppingBag, Handshake, Store } from "lucide-react";
import { MarketplaceHero } from "@/components/home/marketplace-hero";
import { CategoryShowcase } from "@/components/home/category-showcase";
import { ProductCard } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { productsApi } from "@/lib/api";
import { toProduct } from "@/lib/to-product";
import { DEMO_MODE } from "@/lib/runtime-mode";

async function FeaturedProducts({ locale }: { locale: string }) {
  try {
    const result = await productsApi.list({ size: 8 });
    if (!result.items.length) return <p className="py-10 text-gray-500">No products are available yet.</p>;
    return <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">{result.items.map(p => <ProductCard key={p.id} product={toProduct(p)} locale={locale} />)}</div>;
  } catch {
    return <p role="status" className="py-10 text-gray-500">The catalog is temporarily unavailable. Please try again later.</p>;
  }
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const journeys = [
    { icon: ShoppingBag, number: "01", title: "Find something for you", description: "Explore the catalog, inspect a product and build your cart.", href: `/${locale}/products`, cta: "Shop retail" },
    { icon: Handshake, number: "02", title: "Find a better supplier fit", description: "Compare wholesale offers by complete cost and buying constraints.", href: DEMO_MODE ? `/${locale}/demo` : `/${locale}/rfq/new`, cta: "Source wholesale" },
    { icon: Store, number: "03", title: "See the seller perspective", description: "Explore fulfilment steps and stock signals behind the storefront.", href: DEMO_MODE ? `/${locale}/demo?view=seller` : `/${locale}/seller`, cta: "Explore operations" },
  ];
  return <div className="pb-8"><MarketplaceHero locale={locale} />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-sm text-gray-600 dark:text-gray-400">{["Retail + wholesale", "PKR-native pricing", "Three locale routes", "Buyer / seller workflows"].map(label => <p key={label} className="py-3 border-b border-gray-200 dark:border-gray-800">{label}</p>)}</div>
    <CategoryShowcase locale={locale} />
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12"><div className="flex flex-wrap gap-4 justify-between items-end mb-6"><div><p className="demo-eyebrow">THE EVERYDAY EDIT</p><h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Discover the catalog</h2>{DEMO_MODE && <p className="text-sm text-gray-500 mt-2">Illustrative products. Explore every detail without signing up.</p>}</div><Link className="text-sm text-cyan-700 dark:text-cyan-400" href={`/${locale}/products`}>View all products →</Link></div><Suspense fallback={<ProductGridSkeleton count={8} />}><FeaturedProducts locale={locale} /></Suspense></section>
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-16"><p className="demo-eyebrow">ONE MARKETPLACE. THREE PERSPECTIVES.</p><h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-2 mb-6">Choose your next move.</h2><div className="grid md:grid-cols-3 gap-5">{journeys.map(j => <Link key={j.number} href={j.href} className="demo-panel group hover:border-orange-300 transition-colors"><div className="flex justify-between text-gray-400"><j.icon size={24} /><span className="text-xs">{j.number}</span></div><h3 className="text-xl font-semibold mt-6 text-gray-900 dark:text-white">{j.title}</h3><p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{j.description}</p><span className="flex gap-2 items-center mt-6 text-sm font-semibold text-cyan-700 dark:text-cyan-400">{j.cta}<ArrowUpRight size={16} /></span></Link>)}</div></section>
  </div>;
}
