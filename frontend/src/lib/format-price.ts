type Locale = "en" | "ar" | "ur";

const LOCALE_CURRENCY: Record<Locale, string> = {
  en: "PKR",
  ar: "PKR",
  ur: "PKR",
};

export function formatPrice(amount: number, locale: Locale = "en"): string {
  const currency = LOCALE_CURRENCY[locale];
  return new Intl.NumberFormat(locale === "en" ? "en-PK" : locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
