// HU14 · Obtener el link de pago: primero la "API oficial" de la empresa y,
// si no existe, el portal web público ("scraping"). En el ciclo 1 el
// directorio es estático; en el ciclo 2 los conectores harán la consulta real.
import type { PaymentLink } from "@/types";

export interface ProviderPortal {
  match: string[];
  method: "api" | "scraping";
  /**
   * Portal oficial de la empresa. En el ciclo 1 se enlaza la página principal y
   * la referencia se muestra junto al botón "Pagar"; en el ciclo 2 el conector
   * (API oficial o scraping) devolverá la URL exacta del pago.
   */
  url: string;
}

export const PROVIDER_PORTALS: ProviderPortal[] = [
  { match: ["epm"], method: "api", url: "https://www.epm.com.co" },
  { match: ["enel", "codensa"], method: "api", url: "https://www.enel.com.co" },
  { match: ["vanti"], method: "api", url: "https://www.grupovanti.com" },
  { match: ["acueducto", "eaab"], method: "scraping", url: "https://www.acueducto.com.co" },
  { match: ["etb"], method: "scraping", url: "https://etb.com" },
  { match: ["claro"], method: "scraping", url: "https://www.claro.com.co" },
  { match: ["air-e", "aire"], method: "scraping", url: "https://www.air-e.com" },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export type LinkResult = { ok: true; link: PaymentLink } | { ok: false; error: "noReference" | "unsupportedProvider" };

export function resolvePaymentLink(provider: string, reference: string | undefined, now: Date = new Date()): LinkResult {
  if (!reference?.trim()) return { ok: false, error: "noReference" };
  const p = norm(provider);
  const portal = PROVIDER_PORTALS.find((x) => x.match.some((m) => p.includes(m)));
  if (!portal) return { ok: false, error: "unsupportedProvider" };
  return {
    ok: true,
    link: { url: portal.url, method: portal.method, obtainedAt: now.toISOString() },
  };
}
