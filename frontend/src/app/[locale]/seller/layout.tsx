"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useLocale } from "next-intl";
import Link from "next/link";
import { LayoutDashboard, Package, ShoppingBag, Banknote } from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

export default function SellerLayout({ children }: { children: React.ReactNode }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { accessToken, role } = useAuthStore();

  useEffect(() => {
    if (!accessToken || role !== "seller") {
      router.replace(`/${locale}/auth/login`);
    }
  }, [accessToken, role, locale, router]);

  if (!accessToken || role !== "seller") return null;

  const nav = [
    { href: `/${locale}/seller`, label: "Dashboard", icon: LayoutDashboard },
    { href: `/${locale}/seller/products`, label: "Products", icon: Package },
    { href: `/${locale}/seller/orders`, label: "Orders", icon: ShoppingBag },
    { href: `/${locale}/seller/payouts`, label: "Payouts", icon: Banknote },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-56 flex-shrink-0 border-e border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 pt-6">
        <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Seller Hub
        </p>
        <nav className="space-y-0.5 px-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== `/${locale}/seller` && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
