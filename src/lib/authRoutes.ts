// Rutas públicas vs. privadas y enlaces de Auth0. Sin dependencias de
// servidor para poder usarse en el proxy, en componentes y en pruebas.
import { locales } from "@/i18n/config";

export const PUBLIC_SEGMENTS = ["login", "registro", "recuperar"];

/** true si la ruta (con prefijo de idioma) requiere sesión. */
export function isPrivatePath(pathname: string): boolean {
  const [, locale, segment] = pathname.split("/");
  if (!(locales as readonly string[]).includes(locale)) return false;
  if (!segment) return true; // "/es" → dashboard
  return !PUBLIC_SEGMENTS.includes(segment);
}

export type Auth0Intent = "login" | "signup" | "google" | "mfa";

/** URL de Universal Login de Auth0 (rutas montadas por el SDK en /auth/*). */
export function auth0LoginUrl(intent: Auth0Intent, returnTo: string, locale: string): string {
  const params = new URLSearchParams({ returnTo, ui_locales: locale });
  if (intent === "signup") params.set("screen_hint", "signup");
  if (intent === "google") params.set("connection", "google-oauth2");
  // Pide un segundo factor (dispara la inscripción de MFA si aún no la tiene)
  if (intent === "mfa") params.set("acr_values", "http://schemas.openid.net/pape/policies/2007/06/multi-factor");
  return `/auth/login?${params.toString()}`;
}

export const AUTH0_LOGOUT_URL = "/auth/logout";

export const AUTH0_REQUIRED_ENV = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"] as const;

/** Auth0 se activa solo si están TODAS las variables de entorno. */
export function isAuth0Configured(env: Record<string, string | undefined> = process.env): boolean {
  return AUTH0_REQUIRED_ENV.every((key) => Boolean(env[key]));
}
