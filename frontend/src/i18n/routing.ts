import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "ar", "ur"],
  defaultLocale: "en",
  localePrefix: "always",
});
