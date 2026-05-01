"use client";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition } from "react";
import clsx from "clsx";

const locales = [
  { code: "en", label: "EN", nativeLabel: "English" },
  { code: "ar", label: "عربي", nativeLabel: "العربية" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(nextLocale: string) {
    // pathname is like /en/... or /ar/...
    // Replace the locale segment
    const segments = pathname.split("/");
    segments[1] = nextLocale;
    const newPath = segments.join("/") || "/";
    startTransition(() => {
      router.push(newPath);
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-0.5">
      {locales.map((loc) => (
        <button
          key={loc.code}
          onClick={() => switchLocale(loc.code)}
          disabled={isPending}
          title={loc.nativeLabel}
          className={clsx(
            "px-2 py-1 rounded-md text-sm font-medium transition-colors",
            locale === loc.code
              ? "bg-orange-500 text-white"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
          )}
        >
          {loc.label}
        </button>
      ))}
    </div>
  );
}
