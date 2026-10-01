// HU14 · Obtener el link de pago (Alejandro · F3) — funciones puras.
// Ninguna de estas empresas publica una API para terceros, así que el
// servidor hace scraping con IA de sus páginas PÚBLICAS (ver
// lib/paymentLinkService.ts) y, si falla, usa el enlace de respaldo.
// Solo se aceptan enlaces de los dominios oficiales de cada empresa (evita
// llevar al usuario a un sitio falso si la página cambia o es alterada).
// Las URLs se verificaron en las páginas oficiales en octubre de 2026.

export interface ProviderPortal {
  id: string;
  /** Palabras que identifican a la empresa en el nombre del servicio o recibo. */
  match: string[];
  /** Página pública donde la empresa publica su botón de pago. */
  sourcePage: string;
  /** Dominios oficiales del sitio de la empresa (se puede navegar por ellos). */
  siteHosts: string[];
  /** Dominios oficiales de pago (además de siteHosts). */
  allowedHosts: string[];
  /** Patrón del enlace de pago, usado si la IA no está disponible. */
  linkPattern: RegExp;
  /** Portal oficial de pago si el scraping no encuentra el enlace. */
  fallbackUrl: string;
}

export const PROVIDER_PORTALS: ProviderPortal[] = [
  {
    id: "epm",
    siteHosts: ["www.epm.com.co", "epm.com.co"],
    match: ["epm"],
    sourcePage: "https://www.epm.com.co/",
    allowedHosts: ["aplicaciones.epm.com.co"],
    linkPattern: /^https:\/\/aplicaciones\.epm\.com\.co\/facturaweb/i,
    fallbackUrl: "https://aplicaciones.epm.com.co/facturaweb/#/",
  },
  {
    id: "enel",
    siteHosts: ["www.enel.com.co"],
    match: ["enel", "codensa"],
    sourcePage: "https://www.enel.com.co/",
    allowedHosts: ["www.enel.com.co"],
    linkPattern: /^https:\/\/www\.enel\.com\.co\/.*boton-de-pago/i,
    fallbackUrl: "https://www.enel.com.co/es/personas/servicio-al-cliente/boton-de-pago.html",
  },
  {
    id: "vanti",
    siteHosts: ["www.grupovanti.com", "grupovanti.com"],
    match: ["vanti"],
    sourcePage: "https://www.grupovanti.com/tramites-y-ayuda/factura/paga-tu-factura",
    allowedHosts: ["pagosenlinea.grupovanti.com"],
    linkPattern: /^https:\/\/pagosenlinea\.grupovanti\.com\/?$/i,
    fallbackUrl: "https://pagosenlinea.grupovanti.com/",
  },
  {
    id: "acueducto",
    siteHosts: ["www.acueducto.com.co"],
    match: ["acueducto", "eaab"],
    sourcePage: "https://www.acueducto.com.co/",
    allowedHosts: ["pagos.acueducto.com.co"],
    // El botón "Pagos PSE" del sitio lleva a la oficina virtual
    linkPattern: /^https:\/\/(pagos\.acueducto\.com\.co|www\.acueducto\.com\.co\/mioficinavirtual)/i,
    fallbackUrl: "https://pagos.acueducto.com.co/",
  },
  {
    id: "etb",
    siteHosts: ["etb.com", "www.etb.com"],
    match: ["etb"],
    sourcePage: "https://etb.com/",
    allowedHosts: ["etb.com", "www.etb.com"],
    linkPattern: /^https:\/\/(www\.)?etb\.com\/pagos/i,
    fallbackUrl: "https://etb.com/pagos/",
  },
  {
    id: "claro",
    siteHosts: ["www.claro.com.co"],
    match: ["claro"],
    sourcePage: "https://www.claro.com.co/personas/autogestion/portal-pagos/",
    allowedHosts: ["portalpagos.claro.com.co"],
    linkPattern: /^https:\/\/portalpagos\.claro\.com\.co\/.*metodo=formulario&/i,
    fallbackUrl:
      "https://portalpagos.claro.com.co/phrame.php?action=despliegue_personal&clase=vistasclaro&metodo=formulario&operacion=Adicionar&OrigenPago=3&empresa=claro&id_objeto=10002",
  },
  {
    id: "aire",
    siteHosts: ["www.air-e.com", "air-e.com"],
    match: ["air-e", "aire"],
    sourcePage: "https://www.air-e.com/",
    allowedHosts: ["portal.air-e.com"],
    linkPattern: /^https:\/\/portal\.air-e\.com\/pagar/i,
    fallbackUrl: "https://portal.air-e.com/Pagar#/List",
  },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function findProvider(provider: string): ProviderPortal | undefined {
  const p = norm(provider);
  return PROVIDER_PORTALS.find((x) => x.match.some((m) => p.includes(m)));
}

export type LinkError = "noReference" | "unsupportedProvider";

/** Valida los datos antes de buscar el link. */
export function checkLinkRequest(provider: string, reference: string | undefined): { ok: true; portal: ProviderPortal } | { ok: false; error: LinkError } {
  if (!reference?.trim()) return { ok: false, error: "noReference" };
  const portal = findProvider(provider);
  return portal ? { ok: true, portal } : { ok: false, error: "unsupportedProvider" };
}

const decodeEntities = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ");

const attr = (attrs: string, name: string) => attrs.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];

export interface Anchor {
  url: string;
  /** Texto visible del enlace (incluye alt/title de imágenes y aria-label). */
  text: string;
}

/** Extrae los enlaces <a> de un HTML con su texto, como URLs absolutas. */
export function extractAnchors(html: string, baseUrl: string): Anchor[] {
  const out: Anchor[] = [];
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(m[1], "href")?.trim();
    if (!href || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) continue;
    const inner = m[2];
    const imgText = [...inner.matchAll(/<img\b([^>]*)>/gi)].map((i) => attr(i[1], "alt") ?? attr(i[1], "title") ?? "").join(" ");
    const text = decodeEntities(
      [attr(m[1], "aria-label"), attr(m[1], "title"), inner.replace(/<[^>]+>/g, " "), imgText].filter(Boolean).join(" "),
    )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100);
    try {
      out.push({ url: new URL(decodeEntities(href), baseUrl).toString(), text });
    } catch {
      // href inválido: se ignora
    }
  }
  return out;
}

/** Redirección por <meta refresh> o por JavaScript (location.href = "..."). */
export function extractRedirect(html: string, baseUrl: string): string | null {
  const meta = html.match(/<meta[^>]+http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*url\s*=\s*([^"'>\s]+)/i)?.[1];
  const js = html.match(/(?:window\.|self\.|document\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)?.[1] ?? html.match(/location\.replace\(\s*["']([^"']+)["']\s*\)/i)?.[1];
  const target = meta ?? js;
  if (!target) return null;
  try {
    return new URL(decodeEntities(target), baseUrl).toString();
  } catch {
    return null;
  }
}

const hostOf = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
};

/** El enlace es https y pertenece a un dominio oficial de la empresa. */
export function isOfficialUrl(url: string, portal: ProviderPortal): boolean {
  const host = hostOf(url);
  return !!host && (portal.siteHosts.includes(host) || portal.allowedHosts.includes(host));
}

export const isSiteUrl = (url: string, portal: ProviderPortal) => {
  const host = hostOf(url);
  return !!host && portal.siteHosts.includes(host);
};

const ASSET = /\.(css|js|png|jpe?g|gif|svg|ico|webp|woff2?|pdf|zip|mp4)(\?|$)/i;
const RELEVANT = /pag|pse|factura|pay|bill|recaudo|oficina ?virtual/i;
export const MAX_CANDIDATES = 60;

/**
 * Enlaces candidatos para la IA: solo https de dominios oficiales, sin
 * archivos, sin repetidos; primero los que parecen de pagos/facturas.
 */
export function officialCandidates(anchors: Anchor[], portal: ProviderPortal): Anchor[] {
  const seen = new Map<string, Anchor>();
  for (const a of anchors) {
    if (!isOfficialUrl(a.url, portal) || ASSET.test(a.url)) continue;
    const prev = seen.get(a.url);
    if (!prev || (!prev.text && a.text)) seen.set(a.url, a);
  }
  const list = [...seen.values()];
  const relevant = list.filter((a) => RELEVANT.test(`${a.url} ${a.text}`));
  const rest = list.filter((a) => !RELEVANT.test(`${a.url} ${a.text}`));
  return [...relevant, ...rest].slice(0, MAX_CANDIDATES);
}

/** Respaldo sin IA: primer enlace oficial que cumpla el patrón de la empresa. */
export function extractPaymentUrl(html: string, portal: ProviderPortal): string | null {
  for (const a of extractAnchors(html, portal.sourcePage)) {
    if (isOfficialUrl(a.url, portal) && portal.linkPattern.test(a.url)) return a.url;
  }
  return null;
}
