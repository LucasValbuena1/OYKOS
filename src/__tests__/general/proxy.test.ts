/**
 * @jest-environment node
 */
// Proxy de internacionalización (src/proxy.ts): redirección automática según
// las preferencias del navegador.
import { NextRequest } from "next/server";
import { proxy, getLocale } from "@/proxy";
import { switchLocalePath } from "@/components/layout/LanguageSwitcher";
import { isPrivatePath, auth0LoginUrl, isAuth0Configured } from "@/lib/authRoutes";

// Se prueba el proxy sin variables de Auth0 (no se llama a Auth0 real)
jest.mock("@/lib/auth0", () => ({ auth0: null }));

const req = (url: string, headers: Record<string, string> = {}) => new NextRequest(new URL(url, "http://localhost"), { headers });

describe("i18n · Proxy de idioma", () => {

  it("redirige según el Accept-Language del navegador", async () => {
    const res = await proxy(req("/facturas", { "accept-language": "en-US,en;q=0.9" }));
    expect(res?.headers.get("location")).toBe("http://localhost/en/facturas");
  });

  it("usa español por defecto con idiomas no soportados y respeta la cookie", () => {
    expect(getLocale(req("/", { "accept-language": "fr-FR" }))).toBe("es");
    expect(getLocale(req("/", { "accept-language": "es", cookie: "oykos-locale=en" }))).toBe("en");
  });

  it("no redirige si la ruta ya trae un idioma", async () => {
    const res = await proxy(req("/es/login"));
    expect(res.headers.get("location")).toBeNull();
    expect(switchLocalePath("/es/hogares/h1", "en")).toBe("/en/hogares/h1");
  });
});


describe("Seguridad · Rutas privadas y Auth0", () => {
  it("distingue rutas públicas (login, registro…) de privadas", () => {
    expect(isPrivatePath("/es/dashboard")).toBe(true);
    expect(isPrivatePath("/en/hogares/h1")).toBe(true);
    expect(isPrivatePath("/es/login")).toBe(false);
    expect(isPrivatePath("/es/registro")).toBe(false);
  });

  it("arma la URL de Universal Login según la intención", () => {
    expect(auth0LoginUrl("login", "/es/perfil", "es")).toBe("/auth/login?returnTo=%2Fes%2Fperfil&ui_locales=es");
    expect(auth0LoginUrl("signup", "/es", "es")).toContain("screen_hint=signup");
    expect(auth0LoginUrl("google", "/es", "en")).toContain("connection=google-oauth2");
    expect(auth0LoginUrl("mfa", "/es", "es")).toContain("acr_values=");
  });

  it("Auth0 solo se activa cuando están todas las variables de entorno", () => {
    expect(isAuth0Configured({})).toBe(false);
    expect(isAuth0Configured({ AUTH0_DOMAIN: "a", AUTH0_CLIENT_ID: "b", AUTH0_CLIENT_SECRET: "c" })).toBe(false);
    expect(isAuth0Configured({ AUTH0_DOMAIN: "a", AUTH0_CLIENT_ID: "b", AUTH0_CLIENT_SECRET: "c", AUTH0_SECRET: "d" })).toBe(true);
  });
});

describe("Seguridad · rutas privadas en el proxy", () => {
  it("sin Auth0 configurado, una ruta privada lleva al login (que explica qué falta)", async () => {
    const res = await proxy(req("/es/dashboard"));
    expect(res.headers.get("location")).toBe("http://localhost/es/login");
  });
});
