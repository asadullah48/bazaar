import { getTranslations } from "next-intl/server";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryStrip } from "@/components/home/category-strip";
import { ProductCard } from "@/components/product/product-card";
import { Product } from "@/types";

const DEMO_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Premium Cotton Kameez — Embroidered Collar",
    slug: "premium-cotton-kameez",
    price: 2499,
    compare_price: 3500,
    stock_qty: 25,
    images: [{ id: "i1", url: "https://placehold.co/400x400/f97316/white?text=Kameez", alt: "Kameez", is_primary: true }],
    seller: { id: "s1", display_name: "Texcot Textiles", slug: "texcot" },
    avg_rating: 4.5,
    review_count: 128,
  },
  {
    id: "2",
    name: "Kids Wooden Building Blocks Set (100 pcs)",
    slug: "wooden-blocks-100",
    price: 1799,
    compare_price: null,
    stock_qty: 0,
    images: [{ id: "i2", url: "https://placehold.co/400x400/22c55e/white?text=Blocks", alt: "Blocks", is_primary: true }],
    seller: { id: "s2", display_name: "ToyZone PK", slug: "toyzone" },
    avg_rating: 4,
    review_count: 34,
  },
  {
    id: "3",
    name: "Ceramic Non-Stick Fry Pan 28cm",
    slug: "ceramic-fry-pan-28",
    price: 3299,
    compare_price: 4200,
    stock_qty: 12,
    images: [{ id: "i3", url: "https://placehold.co/400x400/3b82f6/white?text=Pan", alt: "Pan", is_primary: true }],
    seller: { id: "s3", display_name: "Kitchen Plus", slug: "kitchenplus" },
    avg_rating: 5,
    review_count: 77,
  },
  {
    id: "4",
    name: "Samsung Galaxy A55 5G — 256GB Midnight Blue",
    slug: "samsung-galaxy-a55",
    price: 89999,
    compare_price: 95000,
    stock_qty: 8,
    images: [{ id: "i4", url: "https://placehold.co/400x400/6366f1/white?text=Phone", alt: "Phone", is_primary: true }],
    seller: { id: "s4", display_name: "MobileMart PK", slug: "mobilemart" },
    avg_rating: 4.5,
    review_count: 203,
  },
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");

  return (
    <div className="pb-16">
      <HeroCarousel />
      <CategoryStrip locale={locale} />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t("featured")}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {DEMO_PRODUCTS.map((p) => (
            <ProductCard key={p.id} product={p} locale={locale} />
          ))}
        </div>
      </section>
    </div>
  );
}
