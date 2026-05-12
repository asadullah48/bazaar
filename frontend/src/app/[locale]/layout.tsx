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
    description: "Shop textiles, electronics, furniture, toys and more",
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
            <Header />
            <CartSidebar locale={locale} />
            <main>{children}</main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
