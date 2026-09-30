import { DemoBanner } from "@/components/demo-banner";
import { SiteFooter } from "@/components/site-footer";
import { DEMO_MODE } from "@/lib/runtime-mode";
import type { Metadata } from "next";
import { Inter, Noto_Kufi_Arabic, Noto_Nastaliq_Urdu } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import { Header } from "@/components/header";
import { CartSidebar } from "@/components/cart/cart-sidebar";
import "../globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const notoKufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
});
const notoNastaliq = Noto_Nastaliq_Urdu({
  subsets: ["arabic"],
  variable: "--font-urdu",
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://shopunity.pk";

  return {
    title: "ShopUnity — Pakistan's Marketplace",
    description: "Explore retail shopping and wholesale sourcing for Pakistani commerce.",
    robots: DEMO_MODE ? { index: false, follow: false } : undefined,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/favicon.ico", sizes: "any" },
        { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      ],
      apple: { url: "/icons/icon-192.png", sizes: "192x192" },
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: "ShopUnity",
    },
    formatDetection: { telephone: false },
    alternates: {
      canonical: `${base}/${locale}`,
      languages: {
        en: `${base}/en`,
        ar: `${base}/ar`,
        ur: `${base}/ur`,
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const messages = await getMessages();
  const dir = locale === "ar" || locale === "ur" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${notoKufi.variable} ${notoNastaliq.variable} font-sans antialiased bg-white dark:bg-gray-950`}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <a href="#main-content" className="skip-link">Skip to content</a>
            <DemoBanner locale={locale} />
            <Header />
            <CartSidebar locale={locale} />
            <main id="main-content">{children}</main>
            <SiteFooter locale={locale} />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
