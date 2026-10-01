// Felipe · Funcionalidad 3 — Obligaciones tributarias (HU09–HU16)
import { screen, within } from "@testing-library/react";
import { TaxesView } from "@/components/taxes/TaxesView";
import { TaxForm } from "@/components/taxes/TaxForm";
import { TaxDetail } from "@/components/taxes/TaxDetail";
import { taxesStore } from "@/data/stores";
import {
  discountedAmount,
  filterTaxes,
  findDuplicateTax,
  generateInstallments,
  installmentsMatch,
  isDiscountActive,
  payableAmount,
  projectTax,
  taxDisplayStatus,
  taxHistory,
  validateTax,
} from "@/lib/domain/taxes";
import type { Tax } from "@/types";
import { renderApp, mockRouter } from "../test-utils";

const NOW = new Date(2026, 8, 30);
const base: Tax = {
  id: "x", type: "predial", assetType: "hogar", assetId: "h1", year: 2026, amount: 1_000_000, dueDate: "2026-10-15",
  status: "pendiente", paymentMode: "contado", installments: [], createdAt: "2026-01-01",
};

describe("HU09 · Listar impuestos", () => {
  it("muestra tipo, bien asociado, año, valor y estado de cada impuesto", () => {
    renderApp(<TaxesView />);
    const item = screen.getAllByRole("link", { name: /Impuesto predial - Casa Principal/ }).find((a) => a.getAttribute("href") === "/es/impuestos/t5")!.closest("li")!;
    expect(item).toHaveTextContent("Año gravable");
    expect(item).toHaveTextContent("$ 1.260.000");
    expect(item).toHaveTextContent("Pendiente");
  });

  it("resalta visualmente los impuestos vencidos y los muestra primero", () => {
    renderApp(<TaxesView />);
    const items = screen.getAllByRole("listitem").filter((li) => li.dataset.status);
    expect(items[0]).toHaveAttribute("data-status", "vencido");
    expect(items[0]).toHaveTextContent("Vencido");
  });

  it("filtra por estado y por bien asociado", () => {
    const all = taxesStore.get();
    expect(filterTaxes(all, { status: "all", assetType: "vehiculo" }).every((t) => t.assetType === "vehiculo")).toBe(true);
    expect(filterTaxes(all, { status: "pagado", assetType: "all" }).every((t) => t.status === "pagado")).toBe(true);
  });

  it("muestra estado vacío con la acción de registrar el primero", () => {
    taxesStore.set([]);
    renderApp(<TaxesView />);
    expect(screen.getByText("No tienes impuestos registrados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Registrar mi primer impuesto" })).toHaveAttribute("href", "/es/impuestos/nuevo");
  });
});

describe("HU10 · Crear impuestos", () => {
  it("el valor solo acepta números positivos", () => {
    expect(validateTax({ type: "predial", assetType: "hogar", assetId: "h1", year: 2026, amount: -5, dueDate: "2026-10-01" }).amount).toBe("positive");
    expect(validateTax({ type: "predial", assetType: "hogar", assetId: "h1", year: 2026, amount: 5, dueDate: "2026-10-01" })).toEqual({});
  });

  it("detecta un impuesto duplicado del mismo tipo, bien y año", () => {
    const dup = findDuplicateTax({ type: "predial", assetType: "hogar", assetId: "h1", year: 2026, amount: 1, dueDate: "x" }, [base]);
    expect(dup?.id).toBe("x");
    expect(findDuplicateTax({ type: "vehicular", assetType: "hogar", assetId: "h1", year: 2026, amount: 1, dueDate: "x" }, [base])).toBeUndefined();
  });

  it("advierte el duplicado en el formulario antes de guardar", async () => {
    const { user } = renderApp(<TaxForm />);
    await user.selectOptions(screen.getByLabelText(/Bien asociado/), "h1");
    await user.clear(screen.getByLabelText(/Año gravable/));
    await user.type(screen.getByLabelText(/Año gravable/), String(new Date().getFullYear()));
    await user.type(screen.getByLabelText(/^Valor/), "900000");
    await user.type(screen.getByLabelText(/Fecha límite de pago/), "2026-12-01");
    await user.click(screen.getByRole("button", { name: "Registrar impuesto" }));
    expect(screen.getByRole("alertdialog", { name: "Impuesto duplicado" })).toBeInTheDocument();
  });

  it("al guardar aparece con estado pendiente", async () => {
    const { user } = renderApp(<TaxForm />);
    await user.selectOptions(screen.getByLabelText(/Tipo de impuesto/), "valorizacion");
    await user.selectOptions(screen.getByLabelText(/Bien asociado/), "h1");
    await user.type(screen.getByLabelText(/^Valor/), "450000");
    await user.type(screen.getByLabelText(/Fecha límite de pago/), "2026-12-01");
    await user.click(screen.getByRole("button", { name: "Registrar impuesto" }));
    const created = taxesStore.get().find((t) => t.type === "valorizacion" && t.assetId === "h1");
    expect(created?.status).toBe("pendiente");
    expect(mockRouter().push).toHaveBeenCalledWith("/es/impuestos");
  });
});

describe("HU11 · Editar impuestos", () => {
  it("precarga el formulario con el impuesto", () => {
    renderApp(<TaxForm id="t5" />);
    expect(screen.getByLabelText(/^Valor/)).toHaveValue(1260000);
    expect(screen.getByLabelText(/Tipo de impuesto/)).toHaveValue("predial");
  });

  it("aplica las validaciones y guarda los cambios", async () => {
    const { user } = renderApp(<TaxForm id="t5" />);
    await user.clear(screen.getByLabelText(/^Valor/));
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByText("Ingresa un número mayor que cero.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/^Valor/), "1300000");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(taxesStore.get().find((t) => t.id === "t5")?.amount).toBe(1_300_000);
  });

  it("advierte antes de editar un impuesto ya pagado", async () => {
    const { user } = renderApp(<TaxDetail id="t4" />);
    await user.click(screen.getByRole("button", { name: /Editar Impuesto predial/ }));
    expect(screen.getByRole("alertdialog", { name: "Este impuesto ya está pagado" })).toBeInTheDocument();
    expect(mockRouter().push).not.toHaveBeenCalled();
  });
});

describe("HU12 · Eliminar impuestos", () => {
  it("la confirmación indica que se pierden el plan de cuotas y soportes", async () => {
    const { user } = renderApp(<TaxDetail id="t7" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Impuesto vehicular/ }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Se perderán el plan de cuotas y los soportes de pago asociados.");
  });

  it("al cancelar no elimina nada", async () => {
    const { user } = renderApp(<TaxDetail id="t7" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Impuesto vehicular/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(taxesStore.get().some((t) => t.id === "t7")).toBe(true);
  });

  it("al confirmar desaparece del listado con mensaje", async () => {
    const { user } = renderApp(<TaxDetail id="t7" />);
    await user.click(screen.getByRole("button", { name: /Eliminar Impuesto vehicular/ }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(taxesStore.get().some((t) => t.id === "t7")).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("eliminado");
  });
});

describe("HU13 · Configurar plan de cuotas", () => {
  it("genera la tabla de cuotas con valor y vencimiento mensual", () => {
    const plan = generateInstallments(1_000_000, 3, "2026-02-15");
    expect(plan.map((c) => c.dueDate)).toEqual(["2026-02-15", "2026-03-15", "2026-04-15"]);
    expect(plan.reduce((a, c) => a + c.amount, 0)).toBe(1_000_000);
  });

  it("detecta cuando la suma de cuotas no coincide con el total", () => {
    const plan = generateInstallments(900, 3, "2026-01-01");
    expect(installmentsMatch(plan, 900)).toBe(true);
    expect(installmentsMatch([{ ...plan[0], amount: 100 }, plan[1], plan[2]], 900)).toBe(false);
  });

  it("al cambiar a cuotas y ajustar una cuota manualmente muestra la alerta de suma", async () => {
    const { user } = renderApp(<TaxDetail id="t5" />);
    await user.click(screen.getByRole("radio", { name: "En cuotas" }));
    expect(within(screen.getByRole("table", { name: "Plan de pago" })).getAllByRole("row")).toHaveLength(1 + 4 + 1);
    const first = screen.getByLabelText("Valor de la cuota 1");
    await user.clear(first);
    await user.type(first, "1");
    expect(screen.getByRole("alert")).toHaveTextContent("La suma de las cuotas no coincide");
  });
});

describe("HU14 · Registrar descuento por pronto pago", () => {
  it("calcula el valor con descuento", () => {
    expect(discountedAmount(1_000_000, 10)).toBe(900_000);
    expect(payableAmount({ ...base, discount: { percent: 10, deadline: "2026-10-05" } }, NOW)).toBe(900_000);
  });

  it("el distintivo solo está vigente hasta la fecha límite", () => {
    const tax = { ...base, discount: { percent: 10, deadline: "2026-10-05" } };
    expect(isDiscountActive(tax, NOW)).toBe(true);
    expect(isDiscountActive(tax, new Date(2026, 9, 6))).toBe(false);
    expect(payableAmount(tax, new Date(2026, 9, 6))).toBe(1_000_000);
  });

  it("el listado muestra 'Pronto pago disponible' en impuestos con descuento vigente", () => {
    renderApp(<TaxesView />);
    const item = screen.getAllByRole("link", { name: /Impuesto predial - Casa Principal/ }).find((a) => a.getAttribute("href") === "/es/impuestos/t5")!.closest("li")!;
    expect(within(item).getByText("Pronto pago disponible")).toBeInTheDocument();
  });

  it("valida el porcentaje al guardar el descuento", async () => {
    const { user } = renderApp(<TaxDetail id="t8" />);
    await user.clear(screen.getByLabelText("Porcentaje de descuento"));
    await user.type(screen.getByLabelText("Porcentaje de descuento"), "150");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("El porcentaje debe estar entre 1 y 99.")).toBeInTheDocument();
  });
});

describe("HU15 · Marcar impuesto como pagado", () => {
  it("cambia el estado a pagado con fecha y valor", async () => {
    const { user } = renderApp(<TaxDetail id="t8" />);
    await user.click(screen.getByRole("button", { name: "Marcar como pagado" }));
    const tax = taxesStore.get().find((t) => t.id === "t8")!;
    expect(tax.status).toBe("pagado");
    expect(tax.payment?.amount).toBe(320_000);
    expect(taxDisplayStatus(tax)).toBe("pagado");
  });

  it("permite adjuntar el soporte en PDF o imagen", async () => {
    const { user } = renderApp(<TaxDetail id="t8" />);
    const file = new File(["%PDF-1.4"], "soporte.pdf", { type: "application/pdf" });
    await user.upload(screen.getByLabelText("Adjuntar comprobante"), file);
    expect(await screen.findByRole("link", { name: /soporte.pdf/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Marcar como pagado" }));
    expect(taxesStore.get().find((t) => t.id === "t8")?.payment?.attachment?.name).toBe("soporte.pdf");
  });

  it("permite revertir la marca de pago", async () => {
    const { user } = renderApp(<TaxDetail id="t4" />);
    await user.click(screen.getByRole("button", { name: "Revertir marca de pago" }));
    expect(taxesStore.get().find((t) => t.id === "t4")?.status).toBe("pendiente");
  });
});

describe("HU16 · Ver histórico y proyección", () => {
  it("construye el histórico por año gravable", () => {
    const history = taxHistory(taxesStore.get().find((t) => t.id === "t5")!, taxesStore.get());
    expect(history.map((h) => h.year)).toHaveLength(5);
    expect(history[0].year).toBeLessThan(history[4].year);
  });

  it("proyecta el próximo año e indica la variación porcentual", () => {
    const p = projectTax([{ year: 2024, amount: 100 }, { year: 2025, amount: 110 }]);
    expect(p).toMatchObject({ sufficient: true, nextYear: 2026, estimate: 121, yoy: 10 });
  });

  it("con menos de dos años informa que no hay datos suficientes", async () => {
    expect(projectTax([{ year: 2025, amount: 100 }]).sufficient).toBe(false);
    renderApp(<TaxDetail id="t8" />);
    expect(screen.getByText(/Aún no hay datos suficientes para proyectar/)).toBeInTheDocument();
  });

  it("el detalle marca la proyección como estimación y no valor oficial", () => {
    renderApp(<TaxDetail id="t5" />);
    expect(screen.getByTestId("tax-projection")).toHaveTextContent("≈");
    expect(screen.getByText(/no un valor oficial/)).toBeInTheDocument();
  });
});
