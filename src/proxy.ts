// src/proxy.ts — punto único de entrada de peticiones (Next.js 16).
// Combina dos responsabilidades:
//
// 1) Auth0: monta /auth/login, /auth/callback,
//    /auth/logout, /auth/profile, renueva la sesión (rolling session) y
//    protege las rutas privadas del lado del servidor.
// 2) Internacionalización (guía oficial:
//    https://nextjs.org/docs/app/guides/internationalization):
//    si la URL no trae idioma, redirige según la cookie "oykos-locale",
//    el header Accept-Language (Negotiator + intl-localematcher) o "es".
import { NextResponse, type NextRequest } from "next/server";
import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { locales, defaultLocale, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import { auth0 } from "@/lib/auth0";
import { auth0LoginUrl, isPrivatePath } from "@/lib/authRoutes";

export function getLocale(request: NextRequest): string {
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  const headers = { "accept-language": request.headers.get("accept-language") ?? "" };
  const languages = new Negotiator({ headers }).languages();
  try {
    return match(languages, [...locales], defaultLocale);
  } catch {
    // match() lanza error si el header trae etiquetas inválidas (p. ej. "*")
    return defaultLocale;
  }
}

/** Copia las cookies de sesión que Auth0 haya renovado a otra respuesta. */
function withAuthCookies(target: NextResponse, source: NextResponse | null) {
  source?.cookies.getAll().forEach((c) => target.cookies.set(c));
  return target;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authResponse = auth0 ? await auth0.middleware(request) : null;

  // Rutas del SDK de Auth0: las resuelve el propio SDK
  if (pathname.startsWith("/auth/")) return authResponse ?? NextResponse.next();

  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (!pathnameHasLocale) {
    const locale = getLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return withAuthCookies(NextResponse.redirect(url), authResponse);
  }

  // Protección en el servidor: sin sesión de Auth0 no se entra a rutas privadas
  if (isPrivatePath(pathname)) {
    const locale = pathname.split("/")[1];
    if (!auth0) {
      // Auth0 sin configurar: la página de login explica qué falta
      return NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    }
    const session = await auth0.getSession(request);
    if (!session) {
      const loginUrl = new URL(auth0LoginUrl("login", pathname, locale), request.url);
      return withAuthCookies(NextResponse.redirect(loginUrl), authResponse);
    }
  }

  return authResponse ?? NextResponse.next();
}

export const config = {
  // Se omiten los assets internos (_next), la API y archivos con extensión.
  matcher: ["/((?!_next/static|_next/image|api|favicon.ico|sitemap.xml|robots.txt|.*\\..*).*)"],
};
