// Gabriela · Funcionalidad 1 — CRUD de facturas (HU01–HU04)
import { screen, within } from "@testing-library/react";
import { InvoicesView } from "@/components/invoices/InvoicesView";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";
import { InvoiceDetail } from "@/components/invoices/InvoiceDetail";
import { invoicesStore, servicesStore } from "@/data/stores";
import { filterInvoices, invoiceDisplayStatus, validateInvoice, emptyInvoice } from "@/lib/domain/invoices";
import { applyConsumptionFilters } from "@/lib/domain/dashboard";
import { toPeriod } from "@/lib/utils";
import type { Invoice } from "@/types";
import { renderApp, mockRouter, setSearch } from "../test-utils";

const NOW = new Date(2026, 8, 30);
const inv = (over: Partial<Invoice>): Invoice => ({
  id: "i", serviceId: "s1", householdId: "h1", period: "2026-09", consumption: 10, amount: 1000, dueDate: "2026-10-20",
  status: "pendiente", source: "manual", createdAt: "2026-09-01", ...over,
});

describe("HU01 · Listar facturas", () => {
  it("muestra servicio, periodo, valor, fecha límite y estado", () => {
    renderApp(<InvoicesView />);
    const item = screen.getAllByRole("link", { name: /Enel Colombia - Energía/ })[0];
    expect(item).toHaveTextContent("$ 142.500");
    expect(item).toHaveTextContent(/Vence en 2 días/i);
    expect(item).toHaveTextContent(/Vto:/);
  });

  it("filtra por hogar, servicio y estado", async () => {
    const { user } = renderApp(<InvoicesView />);
    await user.selectOptions(screen.getByLabelText("Hogar"), "h2");
    await user.click(screen.getByRole("checkbox", { name: "Agua" }));
    await user.click(screen.getByRole("button", { name: "Pendiente" }));
    const links = screen.getAllByRole("link", { name: /Essmar - Agua/ });
    expect(links).toHaveLength(1);
    expect(screen.queryByRole("link", { name: /Air-e/ })).not.toBeInTheDocument();
  });

  it("resalta las facturas vencidas o próximas a vencer y las pone primero", () => {
    const list = filterInvoices(invoicesStore.get(), servicesStore.get(), { householdId: "h1", serviceTypes: [], status: "all" });
    expect(invoiceDisplayStatus(list[0])).toBe("vencida");
    expect(invoiceDisplayStatus(list[1])).toBe("por_vencer");
    renderApp(<InvoicesView />);
    expect(document.querySelectorAll("[data-attention]").length).toBeGreaterThanOrEqual(2);
  });

  it("cada factura lleva a su detalle con el soporte", () => {
    renderApp(<InvoicesView />);
    const link = screen.getAllByRole("link", { name: /Vanti - Gas natural/ })[0];
    expect(link.getAttribute("href")).toMatch(/^\/es\/facturas\/i_s3_/);
  });
});

describe("HU02 · Registrar factura", () => {
  it("el valor y el consumo solo aceptan números positivos", () => {
    const errors = validateInvoice({ ...emptyInvoice("s1", "h1"), period: "2026-09", dueDate: "2026-10-01", amount: -1, consumption: 0 });
    expect(errors).toEqual({ amount: "positive", consumption: "positive" });
  });

  it("permite escoger entre registro manual o foto/PDF del recibo", async () => {
    const { user } = renderApp(<InvoiceForm />);
    expect(screen.getByRole("radio", { name: "Manual" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Foto o PDF" }));
    expect(screen.getByText("Recibo (foto o PDF)")).toBeInTheDocument();
  });

  it("guarda la factura con estado pendiente en el servicio correspondiente", async () => {
    setSearch("servicio=s1");
    const { user } = renderApp(<InvoiceForm />);
    expect(screen.getByLabelText(/Servicio/)).toHaveValue("s1");
    await user.type(screen.getByLabelText(/Periodo facturado/), "2026-10");
    await user.type(screen.getByLabelText(/Fecha límite de pago/), "2026-11-10");
    await user.type(screen.getByLabelText(/Consumo/), "19");
    await user.type(screen.getByLabelText(/^Valor/), "84000");
    await user.click(screen.getByRole("button", { name: "Guardar factura" }));
    const created = invoicesStore.get().at(-1);
    expect(created).toMatchObject({ period: "2026-10", serviceId: "s1", status: "pendiente", amount: 84000, householdId: "h1" });
    expect(mockRouter().push).toHaveBeenCalledWith("/es/facturas");
  });

  it("en modo foto exige adjuntar el recibo", async () => {
    const { user } = renderApp(<InvoiceForm />);
    await user.click(screen.getByRole("radio", { name: "Foto o PDF" }));
    await user.selectOptions(screen.getByLabelText(/Servicio/), "s2");
    await user.type(screen.getByLabelText(/Periodo facturado/), "2026-10");
    await user.type(screen.getByLabelText(/Fecha límite de pago/), "2026-11-10");
    await user.type(screen.getByLabelText(/Consumo/), "19");
    await user.type(screen.getByLabelText(/^Valor/), "84000");
    await user.click(screen.getByRole("button", { name: "Guardar factura" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Adjunta la foto o PDF del recibo.");
  });
});

describe("HU03 · Editar factura", () => {
  const id = `i_s1_${toPeriod(new Date())}`;

  it("precarga el formulario con la factura", () => {
    renderApp(<InvoiceForm id={id} />);
    expect(screen.getByLabelText(/Servicio/)).toHaveValue("s1");
    expect(screen.getByLabelText(/Periodo facturado/)).toHaveValue(toPeriod(new Date()));
  });

  it("los cambios se reflejan en el dashboard y reportes (misma fuente de datos)", async () => {
    const { user } = renderApp(<InvoiceForm id={id} />);
    await user.clear(screen.getByLabelText(/^Valor/));
    await user.type(screen.getByLabelText(/^Valor/), "99999");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    const monthly = applyConsumptionFilters(invoicesStore.get(), servicesStore.get(), { serviceType: "agua", preset: "month" });
    expect(monthly.find((i) => i.id === id)?.amount).toBe(99999);
  });

  it("si se cancela conserva la información original", async () => {
    const original = invoicesStore.get().find((i) => i.id === id)!.amount;
    const { user } = renderApp(<InvoiceForm id={id} />);
    await user.clear(screen.getByLabelText(/^Valor/));
    await user.type(screen.getByLabelText(/^Valor/), "1");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(invoicesStore.get().find((i) => i.id === id)!.amount).toBe(original);
  });
});

describe("HU04 · Eliminar factura", () => {
  const id = `i_s2_${toPeriod(new Date())}`;

  it("la confirmación advierte que dejará de contarse en dashboard y reportes", async () => {
    const { user } = renderApp(<InvoiceDetail id={id} />);
    await user.click(screen.getByRole("button", { name: "Eliminar factura" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent("dejará de contarse en el dashboard y en los reportes");
  });

  it("al cancelar no elimina nada", async () => {
    const { user } = renderApp(<InvoiceDetail id={id} />);
    await user.click(screen.getByRole("button", { name: "Eliminar factura" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(invoicesStore.get().some((i) => i.id === id)).toBe(true);
  });

  it("al confirmar elimina la factura y muestra confirmación", async () => {
    const { user } = renderApp(<InvoiceDetail id={id} />);
    await user.click(screen.getByRole("button", { name: "Eliminar factura" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Eliminar" }));
    expect(invoicesStore.get().some((i) => i.id === id)).toBe(false);
    expect(screen.getByRole("status")).toHaveTextContent("eliminada");
  });

  it("invoiceDisplayStatus distingue pagada, vencida, por vencer y pendiente", () => {
    expect(invoiceDisplayStatus(inv({ status: "pagada" }), NOW)).toBe("pagada");
    expect(invoiceDisplayStatus(inv({ dueDate: "2026-09-29" }), NOW)).toBe("vencida");
    expect(invoiceDisplayStatus(inv({ dueDate: "2026-10-02" }), NOW)).toBe("por_vencer");
    expect(invoiceDisplayStatus(inv({ dueDate: "2026-10-20" }), NOW)).toBe("pendiente");
  });
});
