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

/** Valor estándar (OpenID PAPE) para pedirle a Auth0 un segundo factor. */
export const MFA_ACR = "http://schemas.openid.net/pape/policies/2007/06/multi-factor";

/** Claim que agrega la Action de Auth0: el usuario tiene un segundo factor inscrito. */
export const MFA_ENROLLED_CLAIM = "https://oykos.app/mfa_enrolled";

/** HU11: true si el usuario tiene la verificación en dos pasos activa (según Auth0). */
export function hasMfaEnrolled(claims: Record<string, unknown> | null | undefined): boolean {
  return claims?.[MFA_ENROLLED_CLAIM] === true;
}

/** Tipos de método de Auth0 que son segundo factor (no la contraseña ni el login social). */
export const MFA_METHOD_TYPES = ["totp", "phone", "email", "push-notification", "webauthn-roaming", "webauthn-platform", "recovery-code", "guardian"];

/** Parámetro que agrega la app al volver de la verificación (para avisar el resultado). */
export const MFA_RETURN_PARAM = "mfa";

/**
 * HU11: true si el inicio de sesión usó segundo factor. Auth0 lo indica en el
 * claim `amr` del ID token ("mfa") cuando la verificación en dos pasos se hizo.
 */
export function usedMfa(claims: Record<string, unknown> | null | undefined): boolean {
  const amr = claims?.amr;
  return Array.isArray(amr) && amr.includes("mfa");
}

/** URL de Universal Login de Auth0 (rutas montadas por el SDK en /auth/*). */
export function auth0LoginUrl(intent: Auth0Intent, returnTo: string, locale: string): string {
  const params = new URLSearchParams({ returnTo, ui_locales: locale });
  if (intent === "signup") params.set("screen_hint", "signup");
  if (intent === "google") params.set("connection", "google-oauth2");
  // Pide un segundo factor (dispara la inscripción de MFA si aún no la tiene)
  if (intent === "mfa") params.set("acr_values", MFA_ACR);
  return `/auth/login?${params.toString()}`;
}

export const AUTH0_LOGOUT_URL = "/auth/logout";

export const AUTH0_REQUIRED_ENV = ["AUTH0_DOMAIN", "AUTH0_CLIENT_ID", "AUTH0_CLIENT_SECRET", "AUTH0_SECRET"] as const;

/** Auth0 se activa solo si están TODAS las variables de entorno. */
export function isAuth0Configured(env: Record<string, string | undefined> = process.env): boolean {
  return AUTH0_REQUIRED_ENV.every((key) => Boolean(env[key]));
}
