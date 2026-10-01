// Gabriela · Funcionalidad 2 — Monitoreo y dashboard de consumo (HU05–HU08)
import { screen } from "@testing-library/react";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { invoicesStore, servicesStore, selectedHouseholdStore } from "@/data/stores";
import {
  applyConsumptionFilters,
  breakdownByService,
  classifyVariation,
  historicalComparison,
  periodsForFilter,
  projectNextInvoice,
} from "@/lib/domain/dashboard";
import type { Invoice } from "@/types";
import { renderApp } from "../test-utils";

const NOW = new Date(2026, 8, 30);
const inv = (period: string, amount: number, serviceId = "s1", consumption = 10): Invoice => ({
  id: `${serviceId}-${period}`, serviceId, householdId: "h1", period, consumption, amount, dueDate: `${period}-20`,
  status: "pagada", source: "manual", createdAt: `${period}-01`,
});


describe("HU05 · Ver dashboard general", () => {
  it("muestra el total del mes, el desglose por servicio y las facturas por vencer", () => {
    renderApp(<DashboardView />);
    expect(screen.getByTestId("dashboard-total")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Gastos por servicio" })).toHaveTextContent("Energía");
    expect(screen.getByRole("heading", { name: "Próximos vencimientos" })).toBeInTheDocument();
  });

  it("tiene selector de hogar cuando hay más de una propiedad", async () => {
    const { user } = renderApp(<DashboardView />);
    await user.selectOptions(screen.getByLabelText("Hogar"), "h2");
    expect(selectedHouseholdStore.get()).toBe("h2");
  });

  it("calcula la distribución del gasto por servicio en porcentaje", () => {
    const b = breakdownByService([inv("2026-09", 300, "s1"), inv("2026-09", 100, "s2")], servicesStore.get());
    expect(b).toEqual([
      expect.objectContaining({ serviceType: "agua", share: 75 }),
      expect.objectContaining({ serviceType: "energia", share: 25 }),
    ]);
  });

  it("si el hogar no tiene facturas muestra un estado vacío", () => {
    invoicesStore.set([]);
    renderApp(<DashboardView />);
    expect(screen.getByText("Aún no hay facturas en este hogar")).toBeInTheDocument();
  });
});

describe("HU06 · Filtrar consumo por servicio/periodo", () => {
  it("calcula los periodos de mes, trimestre, año y rango personalizado", () => {
    expect(periodsForFilter({ serviceType: "all", preset: "month" }, NOW)).toEqual(["2026-09"]);
    expect(periodsForFilter({ serviceType: "all", preset: "quarter" }, NOW)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(periodsForFilter({ serviceType: "all", preset: "year" }, NOW)).toHaveLength(12);
    expect(periodsForFilter({ serviceType: "all", preset: "custom", from: "2026-01", to: "2026-02" }, NOW)).toEqual(["2026-01", "2026-02"]);
  });

  it("los indicadores se actualizan con el filtro de servicio", () => {
    const data = [inv("2026-09", 300, "s1"), inv("2026-09", 100, "s2")];
    const filtered = applyConsumptionFilters(data, servicesStore.get(), { serviceType: "energia", preset: "month" }, NOW);
    expect(filtered.map((i) => i.serviceId)).toEqual(["s2"]);
  });

  it("muestra los filtros aplicados y permite limpiarlos con una acción", async () => {
    const { user } = renderApp(<DashboardView />);
    await user.selectOptions(screen.getByLabelText("Tipo de servicio"), "gas");
    expect(screen.getByText("Filtros aplicados:")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(screen.queryByText("Filtros aplicados:")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de servicio")).toHaveValue("all");
  });

  it("informa cuando la combinación de filtros no arroja datos", async () => {
    const { user } = renderApp(<DashboardView />);
    await user.selectOptions(screen.getByLabelText("Tipo de servicio"), "aseo");
    expect(screen.getByText("No hay datos para la combinación de filtros seleccionada.")).toBeInTheDocument();
  });
});

describe("HU07 · Ver comparativa histórica", () => {
  const history = [inv("2025-09", 100), ...["2026-04", "2026-05", "2026-06", "2026-07", "2026-08"].map((p) => inv(p, 100)), inv("2026-09", 130)];

  it("calcula la variación frente al mes anterior y al mismo mes del año pasado", () => {
    const h = historicalComparison(history, NOW);
    expect(h.vsPrevious).toBe(30);
    expect(h.vsLastYear).toBe(30);
  });

  it("resalta como aumento o ahorro las variaciones que superan el umbral", () => {
    expect(classifyVariation(30)).toBe("increase");
    expect(classifyVariation(-20)).toBe("saving");
    expect(classifyVariation(5)).toBe("neutral");
  });

  it("con poca historia muestra solo los meses disponibles con una nota", () => {
    const h = historicalComparison([inv("2026-08", 100), inv("2026-09", 90)], NOW);
    expect(h.monthsAvailable).toBe(2);
    expect(h.limited).toBe(true);
    invoicesStore.set([inv("2026-08", 100), inv("2026-09", 90)]);
    renderApp(<DashboardView />);
    expect(screen.getByText("Solo hay 2 meses de historia disponibles.")).toBeInTheDocument();
  });
});

describe("HU08 · Ver proyección de gasto", () => {
  it("estima la próxima factura con el promedio de los últimos meses", () => {
    const p = projectNextInvoice("s1", "agua", [inv("2026-07", 90), inv("2026-08", 100), inv("2026-09", 110)]);
    expect(p).toMatchObject({ sufficient: true, estimate: 100, previous: 110, difference: -10, monthsUsed: 3 });
  });

  it("si no hay datos suficientes lo informa en lugar de mostrar cero", () => {
    const p = projectNextInvoice("s1", "agua", [inv("2026-09", 110)]);
    expect(p.sufficient).toBe(false);
    expect(p.estimate).toBe(0);
  });

  it("la proyección se marca como estimación y no como valor oficial", () => {
    renderApp(<DashboardView />);
    expect(screen.getByText("Estimación")).toBeInTheDocument();
    expect(screen.getByText(/no es un valor oficial de la empresa prestadora/)).toBeInTheDocument();
    expect(screen.getAllByTestId("projection-card").length).toBe(4);
  });
});
