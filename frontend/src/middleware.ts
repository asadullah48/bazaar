import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PROTECTED = ["/checkout", "/orders", "/account"];

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, "");

  if (PROTECTED.some((p) => pathWithoutLocale.startsWith(p))) {
    const raw = req.cookies.get("bazaar-auth")?.value;
    let isAuth = false;
    if (raw) {
      try {
        isAuth = !!JSON.parse(raw)?.state?.accessToken;
      } catch {}
    }
    if (!isAuth) {
      const locale = pathname.split("/")[1] || "en";
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
