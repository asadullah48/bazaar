import { DEMO_MODE } from "./lib/runtime-mode";
import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PROTECTED = ["/checkout", "/orders", "/account", "/seller", "/admin"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const pathWithoutLocale = pathname.replace(/^\/(en|ar|ur)(?=\/|$)/, "");
  const requestedLocale = pathname.split("/")[1];
  const locale = ["en", "ar", "ur"].includes(requestedLocale) ? requestedLocale : "en";

  if (DEMO_MODE && [...PROTECTED, "/rfq", "/auth"].some(p => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`))) {
    const view = pathWithoutLocale.startsWith("/checkout") ? "checkout" : pathWithoutLocale.startsWith("/seller") || pathWithoutLocale.startsWith("/admin") ? "seller" : "sourcing";
    return NextResponse.redirect(new URL(`/${locale}/demo?view=${view}`, req.url));
  }

  if (PROTECTED.some((p) => pathWithoutLocale === p || pathWithoutLocale.startsWith(`${p}/`))) {
    const raw = req.cookies.get("bazaar-auth")?.value;
    let isAuth = false;
    if (raw) {
      try {
        isAuth = !!JSON.parse(raw)?.state?.accessToken;
      } catch {}
    }
    if (!isAuth) {
      return NextResponse.redirect(
        new URL(`/${locale}/auth/login`, req.url)
      );
    }
  }

  return intlMiddleware(req);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
