// Obtención del link de pago con scraping + IA — SOLO servidor (HU14).
//
// Para cada empresa:
//  1. Descarga su página pública de pagos (fetch, timeout 6 s). Sigue las
//     redirecciones por <meta refresh> o JavaScript (location.href = ...).
//  2. Si la página llega sin enlaces (armada con JavaScript) y Playwright
//     está instalado, la abre en un navegador sin interfaz para leerla.
//     Nunca se usa para evadir bloqueos: si el sitio responde 401/403/429/503
//     se respeta y se pasa al respaldo.
//  3. Extrae los enlaces que apuntan a dominios OFICIALES de la empresa y
//     Claude (Haiku) elige, por número, el enlace de pago o la página a la que
//     conviene ir para encontrarlo (máximo 2 saltos). Responder por número
//     impide que la IA invente URLs; el código valida el resultado.
//  4. Sin IA disponible se usa el patrón conocido de la empresa; si nada
//     funciona, el enlace de respaldo al portal oficial.
// El resultado se guarda en memoria 6 horas (una consulta por empresa).
import type { PaymentLink } from "@/types";
import {
  extractAnchors,
  extractRedirect,
  isOfficialUrl,
  isSiteUrl,
  officialCandidates,
  type Anchor,
  type ProviderPortal,
} from "@/lib/domain/paymentLinks";
import { choosePaymentLink, isClaudeConfigured } from "@/lib/ai/claude";

export const SCRAPE_TIMEOUT_MS = 6000;
export const RENDER_TIMEOUT_MS = 15000;
export const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
/** Un respaldo se guarda poco tiempo para que reintentar sirva. */
export const FALLBACK_TTL_MS = 10 * 60 * 1000;
export const MAX_HOPS = 2;
export const MIN_CONFIDENCE = 0.6;
const MAX_HTML_CHARS = 2_000_000;
const USER_AGENT = "Oykos/1.0 (proyecto academico Uniandes; busca el boton de pago publico)";
const BLOCKED = new Set([401, 403, 429, 503]);

const cache = new Map<string, { link: PaymentLink; expires: number }>();
export function clearPaymentLinkCache() {
  cache.clear();
}

interface Page {
  url: string;
  anchors: Anchor[];
  rendered: boolean;
  blocked: boolean;
}

/** Lo mínimo de Playwright que se usa (es una dependencia opcional). */
interface BrowserLauncher {
  launch(o: { executablePath?: string }): Promise<{
    newPage(o: { userAgent: string }): Promise<{
      goto(url: string, o: { waitUntil: "networkidle"; timeout: number }): Promise<{ status(): number } | null>;
      content(): Promise<string>;
    }>;
    close(): Promise<void>;
  }>;
}

/** Abre la página con Playwright si está instalado (opcional). */
async function renderWithBrowser(url: string): Promise<string | null> {
  if (process.env.OYKOS_DISABLE_BROWSER === "1") return null;
  try {
    const moduleName = "playwright";
    const { chromium } = (await import(/* webpackIgnore: true */ moduleName)) as { chromium: BrowserLauncher };
    const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
    try {
      const page = await browser.newPage({ userAgent: USER_AGENT });
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: RENDER_TIMEOUT_MS });
      if (!res || BLOCKED.has(res.status())) return null;
      return await page.content();
    } finally {
      await browser.close();
    }
  } catch {
    return null; // Playwright no instalado o la página no cargó
  }
}

async function loadPage(url: string, portal: ProviderPortal): Promise<Page> {
  let current = url;
  for (let redirects = 0; redirects <= 2; redirects++) {
    const res = await fetch(current, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
    });
    if (BLOCKED.has(res.status)) return { url: current, anchors: [], rendered: false, blocked: true };
    if (!res.ok) return { url: current, anchors: [], rendered: false, blocked: false };
    const html = (await res.text()).slice(0, MAX_HTML_CHARS);
    const finalUrl = res.url || current;
    const anchors = extractAnchors(html, finalUrl);
    // Redirección por JavaScript o <meta refresh> en una página casi vacía
    const redirect = anchors.length < 3 ? extractRedirect(html, finalUrl) : null;
    if (redirect && isSiteUrl(redirect, portal) && redirect !== finalUrl) {
      current = redirect;
      continue;
    }
    if (officialCandidates(anchors, portal).length > 0) return { url: finalUrl, anchors, rendered: false, blocked: false };
    // Página armada con JavaScript: se intenta con el navegador
    const rendered = await renderWithBrowser(finalUrl);
    return rendered
      ? { url: finalUrl, anchors: extractAnchors(rendered, finalUrl), rendered: true, blocked: false }
      : { url: finalUrl, anchors, rendered: false, blocked: false };
  }
  return { url: current, anchors: [], rendered: false, blocked: false };
}

function patternChoice(candidates: Anchor[], portal: ProviderPortal) {
  return candidates.find((c) => portal.linkPattern.test(c.url))?.url ?? null;
}

export async function resolvePaymentLink(portal: ProviderPortal, now: Date = new Date()): Promise<PaymentLink> {
  const hit = cache.get(portal.id);
  if (hit && hit.expires > now.getTime()) return hit.link;

  const obtainedAt = now.toISOString();
  const visited: string[] = [];
  const useAi = isClaudeConfigured();
  let url = portal.sourcePage;
  let found: PaymentLink | null = null;

  try {
    for (let hop = 0; hop <= MAX_HOPS && !found; hop++) {
      const page = await loadPage(url, portal);
      visited.push(page.url);
      if (page.blocked) break;
      const candidates = officialCandidates(page.anchors, portal);
      if (candidates.length === 0) break;

      let nextUrl: string | null = null;
      if (useAi) {
        try {
          const choice = await choosePaymentLink({
            company: portal.id,
            pageUrl: page.url,
            candidates,
            canNavigate: hop < MAX_HOPS,
            knownPaymentHosts: portal.allowedHosts,
          });
          const pick = choice.paymentIndex !== null ? candidates[choice.paymentIndex] : undefined;
          if (pick && choice.confidence >= MIN_CONFIDENCE && isOfficialUrl(pick.url, portal)) {
            found = { url: pick.url, method: "scraping", engine: "ia", obtainedAt, sourcePage: page.url, pagesVisited: visited.length, rendered: page.rendered };
            break;
          }
          const next = choice.nextIndex !== null ? candidates[choice.nextIndex] : undefined;
          if (next && isSiteUrl(next.url, portal) && !visited.includes(next.url)) nextUrl = next.url;
        } catch (e) {
          console.warn(`[payment-link] la IA no respondió para ${portal.id}:`, (e as Error).message);
        }
      }
      if (!found && !nextUrl) {
        // Sin IA (o la IA no decidió): patrón conocido de la empresa
        const byPattern = patternChoice(candidates, portal);
        if (byPattern) found = { url: byPattern, method: "scraping", engine: "patron", obtainedAt, sourcePage: page.url, pagesVisited: visited.length, rendered: page.rendered };
        break;
      }
      if (nextUrl) url = nextUrl;
    }
  } catch (e) {
    console.warn(`[payment-link] scraping de ${portal.id} falló:`, (e as Error).message);
  }

  const link: PaymentLink = found ?? { url: portal.fallbackUrl, method: "fallback", obtainedAt };
  cache.set(portal.id, { link, expires: now.getTime() + (found ? CACHE_TTL_MS : FALLBACK_TTL_MS) });
  return link;
}
