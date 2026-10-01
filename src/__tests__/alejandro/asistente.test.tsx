// Alejandro · Funcionalidad 2 — Asistente IA (HU06–HU09).
// Los cálculos se prueban directamente; la llamada a Claude (/api/ai/assistant)
// se reemplaza por un fetch simulado solo dentro de las pruebas.
import { screen, within } from "@testing-library/react";
import { AssistantView } from "@/components/ai/AssistantView";
import { seedHouseholds, seedInvoices, seedServices } from "@/data/seed";
import {
  buildFacts,
  consumptionProfile,
  currentScore,
  predictions,
  scoreRange,
  serviceSubScore,
  sustainabilityScore,
} from "@/lib/domain/assistant";
import { sanitizeAssistant } from "@/lib/ai/sanitize";
import { renderApp } from "../test-utils";

const [casa] = seedHouseholds();
const services = seedServices();
const invoices = seedInvoices();

const aiResponse = {
  profileExplanation: "Tu hogar gasta un poco más que hogares similares del estrato 4.",
  scoreExplanation: "La energía es la que más pesa en tu score.",
  recommendations: [
    { id: "ai-energia-0", serviceType: "energia", title: "Desconecta equipos en standby", reason: "Tu consumo supera 200 kWh.", estimatedSaving: 12800 },
    { id: "ai-agua-1", serviceType: "agua", title: "Duchas de 5 minutos", reason: "Hogares similares consumen 20 m³.", estimatedSaving: 9000 },
  ],
};

function mockAssistant(response: { ok: boolean; status?: number; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({ ok: response.ok, status: response.status ?? (response.ok ? 200 : 502), json: async () => response.body });
}

describe("HU06 · Predicción de consumo", () => {
  it("estima el próximo mes por servicio con al menos 3 meses de historial", () => {
    const list = predictions(casa, services, invoices);
    const energia = list.find((p) => p.serviceType === "energia")!;
    expect(energia.sufficient).toBe(true);
    expect(energia.estimate).toBeGreaterThan(0);
  });

  it("indica cuando no hay datos suficientes para predecir", () => {
    const [, playa] = seedHouseholds();
    const agua = predictions(playa, services, invoices).find((p) => p.serviceId === "s6")!;
    expect(agua.sufficient).toBe(false);
  });

  it("muestra la predicción marcada como estimación en la pantalla", async () => {
    mockAssistant({ ok: true, body: aiResponse });
    renderApp(<AssistantView />);
    expect(screen.getAllByTestId("ai-prediction").length).toBe(4);
    expect(screen.getByText("Estimación basada en tu historial; el valor real puede variar.")).toBeInTheDocument();
    await screen.findByTestId("profile-explanation");
  });
});

describe("HU07 · Perfil de consumo", () => {
  it("clasifica el hogar comparándolo con la referencia de su estrato", () => {
    const profile = consumptionProfile(buildFacts(casa, services, invoices));
    expect(profile.sufficient).toBe(true);
    expect(["bajo", "moderado", "alto"]).toContain(profile.level);
    expect(profile.reference).toBe(340_000);
  });

  it("no define perfil sin historial suficiente", () => {
    const facts = buildFacts(casa, services, []);
    expect(consumptionProfile(facts)).toMatchObject({ sufficient: false, level: null });
  });

  it("muestra el nivel y la explicación redactada por Claude", async () => {
    mockAssistant({ ok: true, body: aiResponse });
    renderApp(<AssistantView />);
    expect(screen.getByTestId("profile-level")).toBeInTheDocument();
    expect(await screen.findByTestId("profile-explanation")).toHaveTextContent(aiResponse.profileExplanation);
    expect(global.fetch).toHaveBeenCalledWith("/api/ai/assistant", expect.objectContaining({ method: "POST" }));
  });
});

describe("HU08 · Recomendaciones de ahorro", () => {
  it("valida la respuesta de la IA: descarta tipos inválidos y acota el ahorro", () => {
    const clean = sanitizeAssistant(
      { recommendations: [{ serviceType: "energia", title: "A", reason: "B", estimatedSaving: 999_999 }, { serviceType: "hack", title: "x", reason: "y" }] },
      50_000,
    );
    expect(clean.recommendations).toHaveLength(1);
    expect(clean.recommendations[0].estimatedSaving).toBe(50_000);
  });

  it("muestra las recomendaciones con el ahorro estimado", async () => {
    mockAssistant({ ok: true, body: aiResponse });
    renderApp(<AssistantView />);
    const cards = await screen.findAllByTestId("ai-recommendation");
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText("Desconecta equipos en standby")).toBeInTheDocument();
    expect(within(cards[0]).getByText(/Ahorro estimado/)).toBeInTheDocument();
  });

  it("permite descartar una recomendación", async () => {
    mockAssistant({ ok: true, body: aiResponse });
    const { user } = renderApp(<AssistantView />);
    await screen.findAllByTestId("ai-recommendation");
    await user.click(screen.getByRole("button", { name: "Descartar recomendación: Desconecta equipos en standby" }));
    expect(screen.getAllByTestId("ai-recommendation")).toHaveLength(1);
  });

  it("si Claude falla muestra el error y permite reintentar", async () => {
    mockAssistant({ ok: false, status: 502, body: { error: "aiUnavailable" } });
    const { user } = renderApp(<AssistantView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("El servicio de IA no respondió");
    mockAssistant({ ok: true, body: aiResponse });
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findAllByTestId("ai-recommendation")).toHaveLength(2);
  });

  it("si falta la API key lo explica", async () => {
    mockAssistant({ ok: false, status: 503, body: { error: "aiNotConfigured" } });
    renderApp(<AssistantView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("ANTHROPIC_API_KEY");
  });
});

describe("HU09 · Score de sostenibilidad", () => {
  it("calcula un subscore por servicio frente a la referencia", () => {
    expect(serviceSubScore(100, 200)).toBe(100);
    expect(serviceSubScore(400, 200)).toBe(50);
    expect(serviceSubScore(0, 200)).toBe(100);
  });

  it("pondera los servicios y clasifica el rango", () => {
    const s = sustainabilityScore({ energia: 200, agua: 20, gas: 25 })!;
    expect(s.value).toBe(100);
    expect(scoreRange(35)).toBe("bajo");
    expect(scoreRange(55)).toBe("medio");
    expect(scoreRange(80)).toBe("alto");
    expect(sustainabilityScore({})).toBeNull();
  });

  it("muestra el score, su rango y cómo se calcula", async () => {
    mockAssistant({ ok: true, body: aiResponse });
    renderApp(<AssistantView />);
    const expected = currentScore(buildFacts(casa, services, invoices))!.value;
    expect(screen.getByTestId("score-value")).toHaveTextContent(String(expected));
    expect(screen.getByRole("list", { name: "Escala del score" })).toBeInTheDocument();
    expect(await screen.findByTestId("score-explanation")).toHaveTextContent(aiResponse.scoreExplanation);
  });
});
