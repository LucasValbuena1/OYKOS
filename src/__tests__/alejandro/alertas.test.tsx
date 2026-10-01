// Alejandro · Funcionalidad 1 — CRUD de reglas de alertas por consumo (HU01–HU05)
import { screen, within } from "@testing-library/react";
import { AlertsView } from "@/components/alerts/AlertsView";
import { AlertRuleDetail } from "@/components/alerts/AlertRuleDetail";
import { NotificationsCenter } from "@/components/alerts/NotificationsCenter";
import { alertRulesStore, notificationsStore, invoicesStore } from "@/data/stores";
import { evaluateRules, ruleProgress, validateRule, emptyRule, unreadCount } from "@/lib/domain/alerts";
import type { AlertRule, Invoice } from "@/types";
import { renderApp, mockRouter } from "../test-utils";

const NOW = new Date(2026, 8, 30);
const rule: AlertRule = { id: "r", householdId: "h1", serviceId: "s1", thresholdType: "valor", threshold: 100, channel: "app", active: true, createdAt: "2026-08-01T00:00:00Z" };
const inv = (period: string, amount: number): Invoice => ({
  id: period, serviceId: "s1", householdId: "h1", period, consumption: 5, amount, dueDate: `${period}-20`, status: "pendiente", source: "manual", createdAt: "",
});

describe("HU01 · Listar alertas", () => {
  it("muestra hogar, servicio, tipo de umbral, valor y si está activa", () => {
    renderApp(<AlertsView />);
    const item = screen.getByRole("link", { name: /^Energía · Enel Colombia/ }).closest("li")!;
    expect(item).toHaveTextContent("Casa Principal");
    expect(item).toHaveTextContent("Monto ($)");
    expect(item).toHaveTextContent("$ 150.000");
    expect(within(item).getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("permite activar o desactivar una regla desde el listado", async () => {
    const { user } = renderApp(<AlertsView />);
    await user.click(screen.getByRole("switch", { name: /Desactivar regla de Energía/ }));
    expect(alertRulesStore.get().find((r) => r.id === "r1")?.active).toBe(false);
  });

  it("muestra el contador y el estado vacío", () => {
    const { unmount } = renderApp(<AlertsView />);
    expect(screen.getByText(/4 reglas · 4 activas/)).toBeInTheDocument();
    unmount();
    alertRulesStore.set([]);
    renderApp(<AlertsView />);
    expect(screen.getByText("No tienes reglas configuradas")).toBeInTheDocument();
  });

  it("calcula el progreso y el estado de cada regla", () => {
    expect(ruleProgress(rule, [inv("2026-09", 90)], NOW).state).toBe("near");
    expect(ruleProgress(rule, [inv("2026-09", 150)], NOW).state).toBe("exceeded");
    expect(ruleProgress({ ...rule, active: false }, [], NOW).state).toBe("inactive");
  });
});

describe("HU02 · Crear regla de alerta", () => {
  it("el umbral solo acepta positivos y no puede quedar vacío", () => {
    expect(validateRule({ ...emptyRule("h1"), serviceId: "s1" }).threshold).toBe("required");
    expect(validateRule({ ...emptyRule("h1"), serviceId: "s1", threshold: -3 }).threshold).toBe("positive");
    expect(validateRule({ ...emptyRule("h1"), serviceId: "s1", threshold: 3 })).toEqual({});
  });

  it("permite escoger servicio, tipo de umbral y canal; al guardar queda activa", async () => {
    const { user } = renderApp(<AlertsView />);
    const form = screen.getByRole("heading", { name: "Nueva regla" }).parentElement!;
    await user.selectOptions(within(form).getByLabelText(/Servicio a monitorear/), "s3");
    await user.click(within(form).getByRole("radio", { name: "Consumo (u)" }));
    await user.type(within(form).getByLabelText(/Límite de alerta/), "40");
    await user.selectOptions(within(form).getByLabelText(/Canal de notificación/), "ambos");
    await user.click(within(form).getByRole("button", { name: "Establecer regla" }));
    const created = alertRulesStore.get().at(-1)!;
    expect(created).toMatchObject({ serviceId: "s3", thresholdType: "consumo", threshold: 40, channel: "ambos", active: true });
  });

  it("muestra error si el umbral está vacío", async () => {
    const { user } = renderApp(<AlertsView />);
    const form = screen.getByRole("heading", { name: "Nueva regla" }).parentElement!;
    await user.selectOptions(within(form).getByLabelText(/Servicio a monitorear/), "s3");
    await user.click(within(form).getByRole("button", { name: "Establecer regla" }));
    expect(within(form).getByText("Este campo es obligatorio.")).toBeInTheDocument();
    expect(alertRulesStore.get()).toHaveLength(4);
  });
});

describe("HU03 · Editar regla de alerta", () => {
  it("precarga el formulario con la regla", () => {
    renderApp(<AlertRuleDetail id="r1" />);
    expect(screen.getByLabelText(/Límite de alerta/)).toHaveValue(150000);
    expect(screen.getByLabelText(/Canal de notificación/)).toHaveValue("ambos");
  });

  it("modifica umbral, canal y estado y se refleja en la lista", async () => {
    const { user } = renderApp(<AlertRuleDetail id="r1" />);
    await user.clear(screen.getByLabelText(/Límite de alerta/));
    await user.type(screen.getByLabelText(/Límite de alerta/), "200000");
    await user.selectOptions(screen.getByLabelText(/Canal de notificación/), "email");
    await user.click(screen.getByRole("switch", { name: "Regla activa" }));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(alertRulesStore.get().find((r) => r.id === "r1")).toMatchObject({ threshold: 200000, channel: "email", active: false });
    expect(mockRouter().push).toHaveBeenCalledWith("/es/alertas");
  });

  it("al cancelar se mantiene la configuración original", async () => {
    const { user } = renderApp(<AlertRuleDetail id="r1" />);
    await user.clear(screen.getByLabelText(/Límite de alerta/));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(alertRulesStore.get().find((r) => r.id === "r1")?.threshold).toBe(150000);
  });
});

describe("HU04 · Eliminar regla de alerta", () => {
  it("pide confirmación antes de eliminar", async () => {
    const { user } = renderApp(<AlertRuleDetail id="r1" />);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("La regla dejará de evaluarse");
  });

  it("al cancelar no se elimina nada", async () => {
    const { user } = renderApp(<AlertRuleDetail id="r1" />);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(alertRulesStore.get()).toHaveLength(4);
  });

  it("al confirmar se elimina y las notificaciones generadas se conservan", async () => {
    notificationsStore.set([{ id: "n1", ruleId: "r1", serviceId: "s2", householdId: "h1", period: "2026-09", thresholdType: "valor", threshold: 1, value: 2, read: false, createdAt: "2026-09-01" }]);
    const { user } = renderApp(<AlertRuleDetail id="r1" />);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(alertRulesStore.get().some((r) => r.id === "r1")).toBe(false);
    expect(notificationsStore.get()).toHaveLength(1);
  });
});

describe("HU05 · Recibir notificación", () => {
  it("genera una notificación con servicio, hogar, umbral y valor alcanzado", () => {
    const [n] = evaluateRules([rule], [inv("2026-09", 150)], [], NOW);
    expect(n).toMatchObject({ ruleId: "r", serviceId: "s1", householdId: "h1", threshold: 100, value: 150, read: false, period: "2026-09" });
  });

  it("no notifica más de una vez por la misma regla y periodo", () => {
    const first = evaluateRules([rule], [inv("2026-09", 150)], [], NOW);
    expect(evaluateRules([rule], [inv("2026-09", 150)], first, NOW)).toHaveLength(0);
    expect(evaluateRules([{ ...rule, active: false }], [inv("2026-09", 150)], [], NOW)).toHaveLength(0);
  });

  it("el centro muestra el distintivo de no leídas y permite marcarlas como leídas", async () => {
    notificationsStore.set(evaluateRules([{ ...rule, serviceId: "s4", id: "r4" }], invoicesStore.get().filter((i) => i.serviceId === "s4"), [], new Date()).map((n) => ({ ...n, threshold: 90000 })));
    const total = notificationsStore.get().length;
    expect(total).toBeGreaterThan(0);
    const { user } = renderApp(<NotificationsCenter />);
    expect(screen.getByText(`${total} sin leer`)).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Marcar como leída" })[0]);
    expect(unreadCount(notificationsStore.get())).toBe(total - 1);
  });

  it("desde la notificación se navega al servicio afectado", () => {
    notificationsStore.set([{ id: "n1", ruleId: "r1", serviceId: "s2", householdId: "h1", period: "2026-09", thresholdType: "valor", threshold: 1, value: 2, read: false, createdAt: "2026-09-01" }]);
    renderApp(<NotificationsCenter />);
    expect(screen.getByRole("link", { name: "Ver servicio" })).toHaveAttribute("href", "/es/servicios/s2");
  });
});
