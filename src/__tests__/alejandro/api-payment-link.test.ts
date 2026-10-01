/**
 * @jest-environment node
 */
// HU14 · Link de pago con scraping + IA (POST /api/payment-link).
// Las páginas de las empresas (fetch) y Claude se simulan solo en la prueba.
const getSession = jest.fn();
jest.mock("@/lib/auth0", () => ({ auth0: { getSession: () => getSession() } }));
const choosePaymentLink = jest.fn();
jest.mock("@/lib/ai/claude", () => ({
  isClaudeConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  choosePaymentLink: (...a: unknown[]) => choosePaymentLink(...a),
}));

import { POST } from "@/app/api/payment-link/route";
import { clearPaymentLinkCache } from "@/lib/paymentLinkService";
import { extractAnchors, extractRedirect, findProvider, officialCandidates } from "@/lib/domain/paymentLinks";

const post = (body: unknown) => new Request("http://localhost/api/payment-link", { method: "POST", body: JSON.stringify(body) });
const page = (body: string, url = "", status = 200) => ({ ok: status < 400, status, url, text: async () => body });
const realFetch = global.fetch;
const mockPages = (pages: Record<string, ReturnType<typeof page>>) => {
  global.fetch = jest.fn((url: string) => Promise.resolve(pages[url] ?? page("", url, 404))) as unknown as typeof fetch;
};

beforeEach(() => {
  clearPaymentLinkCache();
  jest.clearAllMocks();
  getSession.mockResolvedValue({ user: { sub: "auth0|1" } });
  process.env.ANTHROPIC_API_KEY = "test";
  process.env.OYKOS_DISABLE_BROWSER = "1";
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
afterAll(() => {
  global.fetch = realFetch;
  delete process.env.ANTHROPIC_API_KEY;
});

describe("Extracción de enlaces de la página", () => {
  const acueducto = findProvider("Acueducto de Bogotá")!;

  it("toma el texto del enlace, incluido el alt de las imágenes", () => {
    const html = `<a href="/mioficinavirtual"><img alt="ver más de Pagos PSE"></a><a href="#top">Arriba</a>`;
    expect(extractAnchors(html, "https://www.acueducto.com.co/x")).toEqual([{ url: "https://www.acueducto.com.co/mioficinavirtual", text: "ver más de Pagos PSE" }]);
  });

  it("detecta redirecciones por JavaScript o meta refresh", () => {
    expect(extractRedirect(`<script>self.location.href = "https://www.acueducto.com.co/wps/portal/EAB2";</script>`, "https://www.acueducto.com.co/")).toBe(
      "https://www.acueducto.com.co/wps/portal/EAB2",
    );
    expect(extractRedirect(`<meta http-equiv="refresh" content="0; url=/inicio">`, "https://etb.com/")).toBe("https://etb.com/inicio");
  });

  it("solo deja candidatos https de dominios oficiales y sin archivos", () => {
    const anchors = extractAnchors(
      `<a href="https://pagos-acueducto.example.com">Falso</a><a href="http://www.acueducto.com.co/p">http</a><a href="/logo.png">img</a><a href="/mi-cuenta/pagos">Pagos</a>`,
      "https://www.acueducto.com.co/",
    );
    expect(officialCandidates(anchors, acueducto).map((a) => a.url)).toEqual(["https://www.acueducto.com.co/mi-cuenta/pagos"]);
  });
});

describe("POST /api/payment-link", () => {
  it("sin sesión responde 401 y valida referencia y empresa", async () => {
    getSession.mockResolvedValue(null);
    expect((await POST(post({ provider: "Vanti", reference: "1" }))).status).toBe(401);
    getSession.mockResolvedValue({ user: {} });
    expect(await (await POST(post({ provider: "Vanti", reference: "" }))).json()).toEqual({ error: "noReference" });
    expect(await (await POST(post({ provider: "Essmar", reference: "1" }))).json()).toEqual({ error: "unsupportedProvider" });
  });

  it("Claude elige el enlace de pago por número y el resultado queda en caché", async () => {
    const src = "https://www.grupovanti.com/tramites-y-ayuda/factura/paga-tu-factura";
    mockPages({ [src]: page(`<a href="/noticias">Noticias</a><a href="https://pagosenlinea.grupovanti.com/">Paga en línea</a>`, src) });
    choosePaymentLink.mockResolvedValue({ paymentIndex: 0, nextIndex: null, confidence: 0.95, reason: "botón de pago" });
    const body = await (await POST(post({ provider: "Vanti S.A.", reference: "102938" }))).json();
    expect(body.link).toMatchObject({ url: "https://pagosenlinea.grupovanti.com/", method: "scraping", engine: "ia", pagesVisited: 1 });
    // los candidatos de pago van primero en la lista que recibe Claude
    expect(choosePaymentLink.mock.calls[0][0].candidates[0].url).toBe("https://pagosenlinea.grupovanti.com/");
    await POST(post({ provider: "Vanti", reference: "102938" }));
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("navega con la IA: sigue la redirección y va a la sección de pagos", async () => {
    const home = "https://www.acueducto.com.co/";
    const portal = "https://www.acueducto.com.co/wps/portal/EAB2";
    const pagos = "https://www.acueducto.com.co/wps/portal/EAB2/Home/mi-cuenta/pagos";
    mockPages({
      [home]: page(`<script>self.location.href = "${portal}";</script>`, home),
      [portal]: page(`<a href="/wps/portal/EAB2/Home/mi-cuenta/pagos">Pagos</a><a href="/ambiente">Ambiente</a>`, portal),
      [pagos]: page(`<a href="/mioficinavirtual"><img alt="ver más de Pagos PSE"></a>`, pagos),
    });
    choosePaymentLink
      .mockResolvedValueOnce({ paymentIndex: null, nextIndex: 0, confidence: 0.8, reason: "sección de pagos" })
      .mockResolvedValueOnce({ paymentIndex: 0, nextIndex: null, confidence: 0.9, reason: "botón PSE" });
    const body = await (await POST(post({ provider: "Acueducto de Bogotá", reference: "1" }))).json();
    expect(body.link).toMatchObject({ url: "https://www.acueducto.com.co/mioficinavirtual", engine: "ia", pagesVisited: 2 });
  });

  it("no acepta respuestas inválidas de la IA: índice inexistente o poca confianza", async () => {
    const src = "https://www.epm.com.co/";
    mockPages({ [src]: page(`<a href="https://aplicaciones.epm.com.co/facturaweb/#/">Paga tu factura</a>`, src) });
    choosePaymentLink.mockResolvedValue({ paymentIndex: 99, nextIndex: null, confidence: 0.99, reason: "x" });
    // con índice inválido se usa el patrón conocido de la empresa
    expect((await (await POST(post({ provider: "EPM", reference: "1" }))).json()).link).toMatchObject({ engine: "patron" });
    clearPaymentLinkCache();
    choosePaymentLink.mockResolvedValue({ paymentIndex: 0, nextIndex: null, confidence: 0.2, reason: "dudoso" });
    expect((await (await POST(post({ provider: "EPM", reference: "1" }))).json()).link).toMatchObject({ engine: "patron" });
  });

  it("sin API key usa el patrón; si el sitio bloquea o no responde, el respaldo", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const air = "https://www.air-e.com/";
    mockPages({ [air]: page(`<a href="https://portal.air-e.com/Pagar#/List">PSE</a>`, air), "https://www.enel.com.co/": page("bloqueado", "", 403) });
    expect((await (await POST(post({ provider: "Air-e", reference: "1" }))).json()).link).toMatchObject({ url: "https://portal.air-e.com/Pagar#/List", engine: "patron" });
    expect((await (await POST(post({ provider: "Enel", reference: "1" }))).json()).link).toMatchObject({ method: "fallback" });
    expect(choosePaymentLink).not.toHaveBeenCalled();
    global.fetch = jest.fn().mockRejectedValue(new Error("timeout")) as unknown as typeof fetch;
    expect((await (await POST(post({ provider: "ETB", reference: "1" }))).json()).link).toMatchObject({ url: "https://etb.com/pagos/", method: "fallback" });
  });
});
