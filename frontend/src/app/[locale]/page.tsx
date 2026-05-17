import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { getTranslations } from "next-intl/server";
import { ShoppingBag, ArrowRight, CheckCircle, Truck, Shield } from "lucide-react";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { CategoryShowcase } from "@/components/home/category-showcase";
import { ProductCard } from "@/components/product/product-card";
import { ProductGridSkeleton } from "@/components/product/product-grid-skeleton";
import { productsApi } from "@/lib/api";
import { toProduct } from "@/lib/to-product";
import { FlashDeals } from "@/components/home/flash-deals";
import type { Product } from "@/types";

// ─── Trust Strip ─────────────────────────────────────────────────────────────
function TrustStrip() {
  const stats = [
    { value: "500+", label: "Verified Sellers" },
    { value: "10K+", label: "Products Listed" },
    { value: "PKR", label: "Primary Currency" },
    { value: "B2C + B2B", label: "Dual Mode" },
  ];
  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border-y border-gray-100 dark:border-gray-800 mt-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-200 dark:divide-gray-700 text-center">
          {stats.map(({ value, label }) => (
            <div key={label} className="px-4 py-1">
              <p className="text-xl sm:text-2xl font-black text-brand-gradient">{value}</p>
              <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-medium uppercase tracking-wide">
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Pitch Banner (ShopUnity logo) ───────────────────────────────────────────
function PitchBanner({ locale }: { locale: string }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
      <div className="relative rounded-3xl overflow-hidden bg-[#0D1525]">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/15 rounded-full blur-3xl translate-x-32 -translate-y-16" />
          <div className="absolute bottom-0 left-32 w-64 h-64 bg-orange-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative flex flex-col lg:flex-row items-center gap-8 p-8 sm:p-12">
          {/* Logo */}
          <div className="flex-shrink-0 w-56 sm:w-72 lg:w-80">
            <Image
              src="/shopunity-pitch-logo.svg"
              alt="ShopUnity — Pakistan's Unified Marketplace"
              width={320}
              height={163}
              className="w-full h-auto"
            />
          </div>

          {/* Text */}
          <div className="text-center lg:text-start flex-1">
            <span className="inline-block text-xs font-semibold bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full mb-3 tracking-wide">
              Pakistan&apos;s First Unified Marketplace
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              One Platform for Every{" "}
              <span className="text-cyan-400">Pakistani Business</span>
            </h2>
            <p className="mt-3 text-gray-400 text-sm leading-relaxed max-w-md">
              Whether you&apos;re a retail shopper or a bulk buyer, ShopUnity connects you
              to verified Pakistani sellers — with AI-powered listings, secure PKR payments,
              and real-time order tracking.
            </p>

            <div className="mt-6 flex flex-wrap gap-3 justify-center lg:justify-start">
              <Link
                href={`/${locale}/auth/register`}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
              >
                Start Selling <ArrowRight size={15} />
              </Link>
              <Link
                href={`/${locale}/products`}
                className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
              >
                Browse Products
              </Link>
            </div>

            <div className="mt-5 flex flex-wrap gap-2 justify-center lg:justify-start">
              {[
                "AI-Powered Listings",
                "JazzCash & Easypaisa",
                "Bilingual EN / اردو",
                "B2B RFQ System",
              ].map((f) => (
                <span
                  key={f}
                  className="text-[11px] bg-white/8 text-gray-300 px-2.5 py-1 rounded-lg border border-white/10"
                >
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── B2B Section ─────────────────────────────────────────────────────────────
function B2BSection({ locale }: { locale: string }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
      <div className="relative rounded-2xl overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1542744094-24638eff58bb?auto=format&w=1200&q=75"
          alt="B2B Wholesale Marketplace"
          width={1200}
          height={400}
          className="w-full h-48 sm:h-64 object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/92 via-cyan-900/75 to-cyan-900/30" />
        <div className="absolute inset-0 flex items-center px-8 sm:px-12">
          <div className="max-w-lg">
            <span className="inline-block text-xs font-semibold bg-white/20 text-white px-3 py-1 rounded-full mb-3">
              B2B Marketplace
            </span>
            <h2 className="text-xl sm:text-3xl font-bold text-white leading-tight">
              Buying in bulk? Get competitive quotes instantly.
            </h2>
            <p className="text-cyan-100 text-sm mt-2 max-w-sm">
              Post an RFQ and let verified Pakistani suppliers come to you — no middlemen.
            </p>
            <div className="flex gap-3 mt-5 flex-wrap">
              <Link
                href={`/${locale}/rfq/new`}
                className="inline-flex items-center gap-2 bg-white text-cyan-700 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-cyan-50 transition-colors"
              >
                Post RFQ <ArrowRight size={15} />
              </Link>
              <Link
                href={`/${locale}/rfq`}
                className="inline-flex items-center gap-2 border border-white/40 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-white/10 transition-colors"
              >
                View RFQs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: ShoppingBag,
      title: "Discover Products",
      desc: "Browse curated products from hundreds of verified Pakistani sellers across every category.",
    },
    {
      n: "02",
      icon: Shield,
      title: "Secure Checkout",
      desc: "Pay safely with JazzCash, Easypaisa, or card — all in PKR, protected end-to-end.",
    },
    {
      n: "03",
      icon: Truck,
      title: "Track & Receive",
      desc: "Real-time order tracking straight to your door, with seller ratings after delivery.",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">How It Works</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Up and shopping in minutes</p>
      </div>
      <div className="grid sm:grid-cols-3 gap-5">
        {steps.map(({ n, icon: Icon, title, desc }) => (
          <div
            key={n}
            className="p-6 rounded-2xl bg-gradient-to-br from-orange-50/80 to-cyan-50/80 dark:from-gray-800 dark:to-gray-800/60 border border-gray-100 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-900/50 transition-colors"
          >
            <span className="text-6xl font-black text-orange-100 dark:text-orange-950/60 leading-none select-none">
              {n}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                <Icon size={16} className="text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-sm">{title}</h3>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Why ShopUnity ────────────────────────────────────────────────────────────
function WhyShopUnity() {
  const reasons = [
    { icon: CheckCircle, text: "100% verified Pakistani sellers" },
    { icon: Shield, text: "Secure PKR payments via JazzCash & Easypaisa" },
    { icon: Truck, text: "Nationwide delivery tracking" },
    { icon: CheckCircle, text: "AI-powered product discovery & ML recommendations" },
  ];
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
      <div className="rounded-2xl bg-gradient-to-r from-orange-50 to-cyan-50 dark:from-gray-800/60 dark:to-gray-800/40 border border-orange-100 dark:border-gray-700 p-6 sm:p-8">
        <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-4">Why ShopUnity?</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {reasons.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <Icon size={16} className="text-orange-500 mt-0.5 flex-shrink-0" />
              <span className="text-sm text-gray-700 dark:text-gray-300">{text}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Featured Products ────────────────────────────────────────────────────────
async function FeaturedProducts({ locale }: { locale: string }) {
  let products: Product[] = [];
  try {
    const res = await productsApi.list({ size: 8 });
    products = res.items.map(toProduct);
  } catch {
    // Backend unavailable — graceful empty state below
  }

  if (products.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-50 to-cyan-50 dark:from-gray-800 dark:to-gray-800/60 flex items-center justify-center border border-orange-100 dark:border-gray-700">
          <ShoppingBag size={36} className="text-orange-400" />
        </div>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
          Products launching soon
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 max-w-xs mx-auto">
          Be among the first sellers on Pakistan&apos;s next great marketplace.
        </p>
        <Link
          href={`/${locale}/auth/register`}
          className="mt-5 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          Register as Seller <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {products.map((p) => (
        <ProductCard key={p.id} product={p} locale={locale} />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://shopunity.pk";

  const orgJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "ShopUnity",
    url: base,
    description: "Pakistan's premier B2C/B2B marketplace — AI-powered, bilingual, PKR-native",
    address: { "@type": "PostalAddress", addressCountry: "PK" },
  };

  return (
    <div className="pb-20">
      <Script id="org-jsonld" type="application/ld+json">
        {JSON.stringify(orgJsonLd)}
      </Script>

      <HeroCarousel />
      <TrustStrip />
      <CategoryShowcase locale={locale} />
      <FlashDeals locale={locale} />
      <PitchBanner locale={locale} />
      <B2BSection locale={locale} />
      <HowItWorks />
      <WhyShopUnity />

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-14">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-orange-500 to-cyan-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t("featured")}</h2>
          <Link
            href={`/${locale}/products`}
            className="ms-auto text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline"
          >
            View all →
          </Link>
        </div>
        <Suspense fallback={<ProductGridSkeleton count={8} />}>
          <FeaturedProducts locale={locale} />
        </Suspense>
      </section>
    </div>
  );
}
