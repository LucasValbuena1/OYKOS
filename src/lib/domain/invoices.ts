// Reglas de negocio de Facturas (Gabriela · Funcionalidad 1).
import type { Invoice, InvoiceDisplayStatus, Service, ServiceType } from "@/types";
import { daysUntil } from "@/lib/utils";
import { isBlank, isPositiveNumber, type FormErrors } from "@/lib/validation";

/** Días de anticipación para considerar una factura "por vencer". */
export const DUE_SOON_DAYS = 5;

export function invoiceDisplayStatus(invoice: Invoice, now: Date = new Date()): InvoiceDisplayStatus {
  if (invoice.status === "pagada") return "pagada";
  const days = daysUntil(invoice.dueDate, now);
  if (days < 0) return "vencida";
  if (days <= DUE_SOON_DAYS) return "por_vencer";
  return "pendiente";
}

export const needsAttention = (status: InvoiceDisplayStatus) => status === "vencida" || status === "por_vencer";

export interface InvoiceFilters {
  householdId: string | "all";
  serviceTypes: ServiceType[];
  status: "all" | "pendiente" | "pagada" | "vencida";
}

export const defaultInvoiceFilters: InvoiceFilters = { householdId: "all", serviceTypes: [], status: "all" };

export function filterInvoices(
  invoices: Invoice[],
  services: Service[],
  filters: InvoiceFilters,
  now: Date = new Date(),
): Invoice[] {
  const typeOf = new Map(services.map((s) => [s.id, s.type]));
  return invoices
    .filter((inv) => filters.householdId === "all" || inv.householdId === filters.householdId)
    .filter((inv) => filters.serviceTypes.length === 0 || filters.serviceTypes.includes(typeOf.get(inv.serviceId)!))
    .filter((inv) => {
      if (filters.status === "all") return true;
      const st = invoiceDisplayStatus(inv, now);
      if (filters.status === "pendiente") return st === "pendiente" || st === "por_vencer";
      if (filters.status === "vencida") return st === "vencida";
      return st === "pagada";
    })
    .sort((a, b) => compareInvoices(a, b, now));
}

const RANK: Record<InvoiceDisplayStatus, number> = { vencida: 0, por_vencer: 1, pendiente: 2, pagada: 3 };

/** Vencidas y por vencer primero; pagadas al final, de la más reciente a la más antigua. */
export function compareInvoices(a: Invoice, b: Invoice, now: Date = new Date()): number {
  const ra = RANK[invoiceDisplayStatus(a, now)];
  const rb = RANK[invoiceDisplayStatus(b, now)];
  if (ra !== rb) return ra - rb;
  return ra === 3 ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate);
}

export type InvoiceInput = Omit<Invoice, "id" | "createdAt" | "status" | "paidAt">;

export const emptyInvoice = (serviceId = "", householdId = ""): InvoiceInput => ({
  serviceId,
  householdId,
  period: "",
  consumption: 0,
  amount: 0,
  dueDate: "",
  source: "manual",
});

export function validateInvoice(input: InvoiceInput): FormErrors<InvoiceInput> {
  const errors: FormErrors<InvoiceInput> = {};
  if (isBlank(input.serviceId)) errors.serviceId = "required";
  if (isBlank(input.period) || !/^\d{4}-\d{2}$/.test(input.period)) errors.period = "required";
  if (!isPositiveNumber(input.consumption)) errors.consumption = "positive";
  if (!isPositiveNumber(input.amount)) errors.amount = "positive";
  if (isBlank(input.dueDate)) errors.dueDate = "required";
  return errors;
}

export function invoiceTotals(invoices: Invoice[]) {
  const total = invoices.reduce((a, i) => a + i.amount, 0);
  const paid = invoices.filter((i) => i.status === "pagada").reduce((a, i) => a + i.amount, 0);
  return { total, paid, progress: total ? Math.round((paid / total) * 100) : 0 };
}
