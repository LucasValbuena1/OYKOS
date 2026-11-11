// Lucas · Correcciones: fecha de pago en el calendario, un solo selector de
// hogar al registrar servicio, marcador de pago y reglas contra duplicados.
import { screen } from "@testing-library/react";
import { buildCalendarEvents } from "@/lib/domain/calendar";
import { isDuplicateProvider, validateService, emptyService } from "@/lib/domain/services";
import { isDuplicateInvoice, validateInvoice, emptyInvoice } from "@/lib/domain/invoices";
import { InvoiceDetail } from "@/components/invoices/InvoiceDetail";
import { Header } from "@/components/layout/Header";
import { invoicesStore, servicesStore, selectedHouseholdStore } from "@/data/stores";
import { CalendarView } from "@/components/calendar/CalendarView";
import type { Invoice } from "@/types";
import { renderApp, setPathname } from "../test-utils";

const NOW = new Date("2026-11-10T12:00:00");
const inv = (over: Partial<Invoice> = {}): Invoice => ({
  id: "x1", serviceId: "s1", householdId: "h1", period: "2026-10", consumption: 10, amount: 50_000, dueDate: "2026-11-05",
  status: "pendiente", source: "manual", createdAt: "2026-10-01", ...over,
});

describe("Calendario · fecha de pago de las facturas", () => {
  it("una factura pagada aparece en su vencimiento y también en el día en que se pagó", () => {
    const events = buildCalendarEvents([inv({ status: "pagada", paidAt: "2026-11-02" })], [], () => "Agua", () => "", NOW);
    expect(events).toHaveLength(2);
    expect(events.find((e) => e.kind === "due")).toMatchObject({ date: "2026-11-05", state: "paid", paidAt: "2026-11-02" });
    expect(events.find((e) => e.kind === "payment")).toMatchObject({ date: "2026-11-02", state: "paid", dueDate: "2026-11-05" });
  });

  it("si se pagó el mismo día del vencimiento o sigue pendiente, solo hay un evento", () => {
    expect(buildCalendarEvents([inv({ status: "pagada", paidAt: "2026-11-05" })], [], () => "", () => "", NOW)).toHaveLength(1);
    expect(buildCalendarEvents([inv()], [], () => "", () => "", NOW)).toEqual([expect.objectContaining({ kind: "due", state: "overdue" })]);
  });
});

describe("Selector de hogar del encabezado", () => {
  const header = () => renderApp(<Header onOpenMenu={() => {}} menuOpen={false} menuId="m" />);
  it.each(["/es/calendario", "/es/alertas", "/es/incidentes"])("aparece en %s, que se filtra por el hogar activo", (path) => {
    setPathname(path);
    header();
    expect(screen.getByLabelText("Hogar activo")).toBeInTheDocument();
  });
  it.each(["/es/servicios/nuevo", "/es/servicios", "/es/dashboard", "/es/hogares", "/es/facturas", "/es/vehiculos", "/es/impuestos", "/es/reportes", "/es/perfil"])(
    "no aparece en %s (sin clasificar por hogar, o con selector o filtro propio)",
    (path) => {
      setPathname(path);
      header();
      expect(screen.queryByLabelText("Hogar activo")).not.toBeInTheDocument();
    },
  );
});

describe("Calendario · fecha límite en lugar de 'Pendiente'", () => {
  it("cada vencimiento indica su fecha límite y se filtra por el hogar activo", async () => {
    invoicesStore.set([inv({ id: "c1", dueDate: "2030-01-15", period: "2029-12" }), inv({ id: "c2", serviceId: "s5", householdId: "h2", dueDate: "2030-01-15", period: "2029-12" })]);
    selectedHouseholdStore.set("h1");
    const { user } = renderApp(<CalendarView />);
    for (let k = 0; k < 120 && !screen.queryByText(/enero de 2030/i, { selector: "p" }); k++) await user.click(screen.getByRole("button", { name: "Mes siguiente" }));
    await user.click(screen.getByRole("button", { name: /15 de enero de 2030/ }));
    expect(screen.getByText(/Fecha límite: 15 .*ene.* 2030/)).toBeInTheDocument();
    expect(screen.queryByText("Pendiente", { selector: "span" })).not.toBeInTheDocument();
    // La factura del otro hogar no aparece
    expect(screen.getAllByText(/Fecha límite/)).toHaveLength(1);
  });
});

describe("Reglas de negocio contra duplicados", () => {
  it("no permite registrar dos veces el mismo tipo de servicio con la misma empresa en un hogar", () => {
    const input = { ...emptyService("h1"), type: "energia" as const, provider: "  enel colombia ", accountNumber: "111" };
    expect(isDuplicateProvider(input, servicesStore.get())).toBe(true);
    expect(validateService(input, servicesStore.get()).provider).toBe("duplicateProvider");
    expect(isDuplicateProvider({ ...input, householdId: "h2" }, servicesStore.get())).toBe(false);
    // Al editar el mismo servicio no cuenta como duplicado
    expect(isDuplicateProvider(input, servicesStore.get(), "s2")).toBe(false);
  });

  it("no permite dos facturas del mismo servicio y periodo (p. ej. escanear el mismo recibo dos veces)", () => {
    const existing = [inv({ id: "a" })];
    expect(isDuplicateInvoice({ serviceId: "s1", period: "2026-10" }, existing)).toBe(true);
    expect(isDuplicateInvoice({ serviceId: "s1", period: "2026-11" }, existing)).toBe(false);
    expect(isDuplicateInvoice({ serviceId: "s1", period: "2026-10" }, existing, "a")).toBe(false);
    const base = { ...emptyInvoice("s1", "h1"), period: "2026-10", dueDate: "2026-11-05", amount: 1, consumption: 1 };
    expect(validateInvoice(base, existing).period).toBe("duplicateInvoice");
  });
});

describe("Marcador de factura pagada", () => {
  it("muestra la fecha de pago y permite desmarcarlo", async () => {
    invoicesStore.set([inv({ id: "p1", status: "pagada", paidAt: "2026-11-02" })]);
    const { user } = renderApp(<InvoiceDetail id="p1" />);
    expect(screen.getByTestId("invoice-paid-on")).toHaveTextContent(/Pagada el/);
    await user.click(screen.getByRole("button", { name: "Desmarcar pago" }));
    expect(invoicesStore.get()[0]).toMatchObject({ status: "pendiente", paidAt: undefined });
    expect(screen.getByRole("button", { name: "Marcar como pagada" })).toBeInTheDocument();
  });

  it("si la factura tiene link de pago, el marcador está solo en el panel de pago (sin botón repetido)", () => {
    invoicesStore.set([
      inv({ id: "p2", reference: "123", paymentLink: { url: "https://www.enel.com.co/", method: "fallback", obtainedAt: "2026-11-01" } }),
    ]);
    renderApp(<InvoiceDetail id="p2" />);
    expect(screen.queryByRole("button", { name: "Marcar como pagada" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ya pagué" })).toBeInTheDocument();
  });
});
