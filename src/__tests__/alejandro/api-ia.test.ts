/**
 * @jest-environment node
 */
// Rutas de IA en el servidor: exigen sesión de Auth0, validan el archivo y
// nunca inventan datos cuando Claude no está disponible.
const getSession = jest.fn();
jest.mock("@/lib/auth0", () => ({ auth0: { getSession: () => getSession() } }));
const extractReceipt = jest.fn();
const assistantInsights = jest.fn();
jest.mock("@/lib/ai/claude", () => ({
  isClaudeConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  extractReceipt: (...a: unknown[]) => extractReceipt(...a),
  assistantInsights: (...a: unknown[]) => assistantInsights(...a),
}));

import { POST as scan } from "@/app/api/ai/scan-receipt/route";
import { POST as assistant } from "@/app/api/ai/assistant/route";
import { buildFacts } from "@/lib/domain/assistant";
import { seedHouseholds, seedInvoices, seedServices } from "@/data/seed";

const post = (body: unknown) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
const png = { mediaType: "image/png", data: Buffer.from("img").toString("base64") };
const facts = buildFacts(seedHouseholds()[0], seedServices(), seedInvoices());

beforeEach(() => {
  getSession.mockResolvedValue({ user: { sub: "auth0|1" } });
  process.env.ANTHROPIC_API_KEY = "test-key";
  jest.clearAllMocks();
});
afterAll(() => delete process.env.ANTHROPIC_API_KEY);

describe("POST /api/ai/scan-receipt", () => {
  it("sin sesión de Auth0 responde 401", async () => {
    getSession.mockResolvedValue(null);
    expect((await scan(post(png))).status).toBe(401);
    expect(extractReceipt).not.toHaveBeenCalled();
  });

  it("rechaza formatos no permitidos y responde 503 sin API key", async () => {
    expect((await scan(post({ ...png, mediaType: "image/gif" }))).status).toBe(400);
    delete process.env.ANTHROPIC_API_KEY;
    const res = await scan(post(png));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "aiNotConfigured" });
  });

  it("devuelve la extracción validada de Claude o 422 si no es legible", async () => {
    extractReceipt.mockResolvedValue({ provider: { value: "Enel", confidence: 0.9 }, amount: { value: "120.000", confidence: 0.8 } });
    const ok = await (await scan(post(png))).json();
    expect(ok.extraction.amount.value).toBe(120000);
    extractReceipt.mockResolvedValue({});
    expect((await scan(post(png))).status).toBe(422);
    extractReceipt.mockRejectedValue(new Error("timeout"));
    expect((await scan(post(png))).status).toBe(502);
  });
});

describe("POST /api/ai/assistant", () => {
  it("sin sesión responde 401 y con datos inválidos 400", async () => {
    getSession.mockResolvedValue(null);
    expect((await assistant(post({ facts }))).status).toBe(401);
    getSession.mockResolvedValue({ user: {} });
    expect((await assistant(post({ facts: {} }))).status).toBe(400);
  });

  it("devuelve las recomendaciones de Claude ya validadas", async () => {
    assistantInsights.mockResolvedValue({
      profileExplanation: "Perfil",
      scoreExplanation: "Score",
      recommendations: [{ serviceType: "energia", title: "Apaga luces", reason: "Consumo alto", estimatedSaving: 5000 }],
    });
    const body = await (await assistant(post({ facts, locale: "es" }))).json();
    expect(body.recommendations[0]).toMatchObject({ serviceType: "energia", title: "Apaga luces", estimatedSaving: 5000 });
  });

  it("si Claude falla responde 502 (no inventa recomendaciones)", async () => {
    assistantInsights.mockRejectedValue(new Error("down"));
    expect((await assistant(post({ facts }))).status).toBe(502);
  });
});
