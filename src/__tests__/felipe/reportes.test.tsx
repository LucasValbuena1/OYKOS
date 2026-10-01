// Felipe · Funcionalidad 2 — Exportación y generación de reportes (HU05–HU08)
import { act, screen, within } from "@testing-library/react";
import { ReportsView } from "@/components/reports/ReportsView";
import { reportsStore, invoicesStore, servicesStore, taxesStore, householdsStore } from "@/data/stores";
import {
  generateReportData,
  quickRange,
  reportFileName,
  sortReports,
  toSpreadsheetXml,
  validateSelection,
} from "@/lib/domain/reports";
import { buildExcel, type ExportLabels } from "@/lib/export";
import type { Report } from "@/types";
import { renderApp } from "../test-utils";

jest.mock("@/lib/export", () => {
  const actual = jest.requireActual("@/lib/export");
  return { ...actual, exportPdf: jest.fn(async () => "reporte.pdf"), exportExcel: jest.fn(async () => "reporte.xls") };
});
const exportMock = jest.requireMock("@/lib/export") as { exportPdf: jest.Mock; exportExcel: jest.Mock };

const NOW = new Date(2026, 8, 30);

async function generate(user: ReturnType<typeof renderApp>["user"]) {
  await user.click(screen.getByRole("button", { name: "Generar vista previa" }));
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
}

describe("HU05 · Seleccionar rango y tipo de reporte", () => {
  it("valida que la fecha de inicio sea anterior a la de fin", () => {
    expect(validateSelection({ householdId: "h1", type: "gastos", from: "2026-09-01", to: "2026-08-01" })).toBe("order");
    expect(validateSelection({ householdId: "h1", type: "gastos", from: "2026-08-01", to: "2026-09-01" })).toBeNull();
  });

  it("ofrece rangos rápidos (último mes, 3 meses, último año)", () => {
    expect(quickRange("1m", NOW)).toEqual({ from: "2026-08-30", to: "2026-09-30" });
    expect(quickRange("3m", NOW).from).toBe("2026-06-30");
    expect(quickRange("12m", NOW).from).toBe("2025-09-30");
  });

  it("deshabilita el botón generar mientras la selección no es válida", async () => {
    const { user } = renderApp(<ReportsView />);
    const button = screen.getByRole("button", { name: "Generar vista previa" });
    expect(button).toBeEnabled();
    await user.clear(screen.getByLabelText("Fecha de fin"));
    await user.type(screen.getByLabelText("Fecha de fin"), "2020-01-01");
    expect(button).toBeDisabled();
    expect(screen.getByText("La fecha de inicio debe ser anterior a la fecha de fin.")).toBeInTheDocument();
  });

  it("permite escoger el tipo de reporte y el hogar", async () => {
    const { user } = renderApp(<ReportsView />);
    await user.click(screen.getByRole("radio", { name: "Impuestos" }));
    expect(screen.getByRole("radio", { name: "Impuestos" })).toBeChecked();
    await user.selectOptions(screen.getByLabelText("Hogar"), "h2");
    expect(screen.getByLabelText("Hogar")).toHaveValue("h2");
  });
});

describe("HU06 · Generar reporte", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("calcula total, consumo por servicio y variación frente al periodo anterior", () => {
    const data = generateReportData(
      { householdId: "h1", type: "gastos", from: "2026-07-01", to: "2026-09-30" },
      invoicesStore.get(),
      servicesStore.get(),
      taxesStore.get(),
    );
    const expected = invoicesStore.get().filter((i) => i.householdId === "h1" && ["2026-07", "2026-08", "2026-09"].includes(i.period));
    expect(data.total).toBe(expected.reduce((a, i) => a + i.amount, 0));
    expect(data.byService.map((s) => s.serviceType).sort()).toEqual(["agua", "energia", "gas", "internet"]);
    expect(data.variation).not.toBeNull();
  });

  it("muestra un indicador de carga mientras se genera", async () => {
    const { user } = renderApp(<ReportsView />, {});
    await user.click(screen.getByRole("button", { name: "Generar vista previa" }));
    expect(screen.getByText("Generando reporte…")).toBeInTheDocument();
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.queryByText("Generando reporte…")).not.toBeInTheDocument();
    expect(screen.getByTestId("report-total")).toBeInTheDocument();
  });

  it("incluye una gráfica de evolución del gasto", async () => {
    const { user } = renderApp(<ReportsView />);
    await generate(user);
    expect(screen.getByRole("figure", { name: "Evolución del gasto" })).toBeInTheDocument();
  });

  it("si no hay datos en el rango muestra un mensaje informativo", async () => {
    const { user } = renderApp(<ReportsView />);
    await user.clear(screen.getByLabelText("Fecha de inicio"));
    await user.type(screen.getByLabelText("Fecha de inicio"), "2010-01-01");
    await user.clear(screen.getByLabelText("Fecha de fin"));
    await user.type(screen.getByLabelText("Fecha de fin"), "2010-06-01");
    await generate(user);
    expect(screen.getByText("No hay datos en el rango seleccionado para generar el reporte.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Descargar PDF" })).not.toBeInTheDocument();
  });
});

describe("HU07 · Exportar reporte", () => {
  const report: Report = {
    id: "rep_x",
    householdId: "h1",
    type: "gastos",
    from: "2026-07-01",
    to: "2026-09-30",
    createdAt: "2026-09-30T10:00:00.000Z",
    data: { total: 1000, previousTotal: 800, variation: 25, byService: [], monthly: [], rows: [{ label: "agua", period: "2026-09", amount: 1000, status: "pagada" }] },
  };

  it("el nombre del archivo incluye el hogar y el rango consultado", () => {
    expect(reportFileName(report, { name: "Casa Principal" }, "pdf")).toBe("oykos-gastos-casa-principal-2026-07-01_2026-09-30.pdf");
    expect(reportFileName(report, { name: "Apartamento Playa" }, "xls")).toMatch(/apartamento-playa.*\.xls$/);
  });

  it("el Excel conserva encabezado (hogar, rango), totales y la tabla de datos", () => {
    const labels = {
      title: "Reporte", household: "Hogar", range: "Rango", generated: "Generado", total: "Total", previous: "Anterior", variation: "Variación",
      columns: ["Concepto", "Periodo", "Monto", "Estado"], formatMoney: (v: number) => `$${v}`,
      formatRow: (r: Report["data"]["rows"][number]) => [r.label, r.period, `$${r.amount}`, r.status],
      rangeText: "1 jul – 30 sep", generatedText: "hoy", variationText: "+25%",
    } as ExportLabels;
    const { content, fileName } = buildExcel(report, householdsStore.get()[0], labels);
    expect(fileName).toMatch(/\.xls$/);
    expect(content).toContain("Casa Principal");
    expect(content).toContain("1 jul – 30 sep");
    expect(content).toContain('<Data ss:Type="Number">1000</Data>');
  });

  it("escapa caracteres especiales en la hoja de cálculo", () => {
    expect(toSpreadsheetXml("T", ["A"], [], [["<b>&"]])).toContain("&lt;b&gt;&amp;");
  });

  it("si la exportación falla muestra error y permite reintentar", async () => {
    jest.useFakeTimers();
    exportMock.exportPdf.mockRejectedValueOnce(new Error("fallo"));
    const { user } = renderApp(<ReportsView />);
    await generate(user);
    await user.click(screen.getByRole("button", { name: "Descargar PDF" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No se pudo exportar el archivo.");
    await user.click(within(alert).getByRole("button", { name: "Reintentar" }));
    expect(exportMock.exportPdf).toHaveBeenCalledTimes(2);
    jest.useRealTimers();
  });
});

describe("HU08 · Ver historial de reportes", () => {
  const make = (id: string, createdAt: string): Report => ({
    id, householdId: "h1", type: "gastos", from: "2026-01-01", to: "2026-02-01", createdAt,
    data: { total: 0, previousTotal: 0, variation: null, byService: [], monthly: [], rows: [] },
  });

  it("ordena del más reciente al más antiguo", () => {
    const sorted = sortReports([make("a", "2026-01-01T00:00:00Z"), make("b", "2026-03-01T00:00:00Z"), make("c", "2026-02-01T00:00:00Z")]);
    expect(sorted.map((r) => r.id)).toEqual(["b", "c", "a"]);
  });

  it("lista los reportes generados con tipo, hogar, rango y fecha", async () => {
    reportsStore.set([make("a", "2026-01-01T00:00:00Z"), make("b", "2026-03-01T00:00:00Z")]);
    const { user } = renderApp(<ReportsView />);
    await user.click(screen.getByRole("tab", { name: /Historial/ }));
    const rows = screen.getAllByTestId("history-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("Gastos");
    expect(rows[0]).toHaveTextContent("Casa Principal");
  });

  it("permite volver a ver un reporte sin generarlo de nuevo", async () => {
    reportsStore.set([make("a", "2026-01-01T00:00:00Z")]);
    const { user } = renderApp(<ReportsView />);
    await user.click(screen.getByRole("tab", { name: /Historial/ }));
    await user.click(screen.getByRole("button", { name: "Ver reporte" }));
    expect(screen.getByRole("region", { name: /oykos-gastos-casa-principal/ })).toBeInTheDocument();
    expect(reportsStore.get()).toHaveLength(1);
  });

  it("permite eliminar un reporte previa confirmación", async () => {
    reportsStore.set([make("a", "2026-01-01T00:00:00Z")]);
    const { user } = renderApp(<ReportsView />);
    await user.click(screen.getByRole("tab", { name: /Historial/ }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(reportsStore.get()).toHaveLength(0);
  });
});
