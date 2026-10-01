// Reglas de negocio de Impuestos (Felipe · Funcionalidad 3).
import type { Installment, Tax, TaxAssetType, TaxDisplayStatus, TaxType } from "@/types";
import { addMonths, daysUntil, parseDate, sum, toISODate, variation } from "@/lib/utils";
import { isBlank, isPositiveNumber, type FormErrors } from "@/lib/validation";

export const TAX_TYPES: TaxType[] = ["predial", "vehicular", "valorizacion"];

export function taxDisplayStatus(tax: Tax, now: Date = new Date()): TaxDisplayStatus {
  if (tax.status === "pagado") return "pagado";
  // Con cuotas: está vencido si alguna cuota no pagada ya venció
  if (tax.paymentMode === "cuotas" && tax.installments.length) {
    return tax.installments.some((c) => !c.paid && daysUntil(c.dueDate, now) < 0) ? "vencido" : "pendiente";
  }
  return daysUntil(tax.dueDate, now) < 0 ? "vencido" : "pendiente";
}

export interface TaxFilters {
  status: "all" | TaxDisplayStatus;
  assetType: "all" | TaxAssetType;
}

export function filterTaxes(taxes: Tax[], filters: TaxFilters, now: Date = new Date()): Tax[] {
  return taxes
    .filter((t) => filters.status === "all" || taxDisplayStatus(t, now) === filters.status)
    .filter((t) => filters.assetType === "all" || t.assetType === filters.assetType)
    .sort((a, b) => {
      const order = { vencido: 0, pendiente: 1, pagado: 2 } as const;
      const diff = order[taxDisplayStatus(a, now)] - order[taxDisplayStatus(b, now)];
      return diff !== 0 ? diff : a.dueDate.localeCompare(b.dueDate);
    });
}

export type TaxInput = Pick<Tax, "type" | "assetType" | "assetId" | "year" | "amount" | "dueDate">;

export const emptyTax = (): TaxInput => ({
  type: "predial",
  assetType: "hogar",
  assetId: "",
  year: new Date().getFullYear(),
  amount: 0,
  dueDate: "",
});

export function validateTax(input: TaxInput): FormErrors<TaxInput> {
  const errors: FormErrors<TaxInput> = {};
  if (!TAX_TYPES.includes(input.type)) errors.type = "required";
  if (isBlank(input.assetId)) errors.assetId = "required";
  if (!Number.isInteger(input.year) || input.year < 2000 || input.year > new Date().getFullYear() + 1) {
    errors.year = "yearRange";
  }
  if (!isPositiveNumber(input.amount)) errors.amount = "positive";
  if (isBlank(input.dueDate)) errors.dueDate = "required";
  return errors;
}

/** true si ya existe un impuesto del mismo tipo, bien y año gravable. */
export function findDuplicateTax(input: TaxInput, taxes: Tax[], editingId?: string): Tax | undefined {
  return taxes.find(
    (t) =>
      t.id !== editingId &&
      t.type === input.type &&
      t.assetId === input.assetId &&
      t.year === input.year,
  );
}

// ---------- Plan de cuotas (HU13) ----------
/** Genera N cuotas iguales mensuales; la última absorbe el residuo del redondeo. */
export function generateInstallments(total: number, count: number, firstDueDate: string): Installment[] {
  if (count < 1) return [];
  const base = Math.floor(total / count);
  const first = parseDate(firstDueDate);
  return Array.from({ length: count }, (_, idx) => ({
    number: idx + 1,
    amount: idx === count - 1 ? total - base * (count - 1) : base,
    dueDate: toISODate(addMonths(first, idx)),
    paid: false,
  }));
}

export function installmentsTotal(installments: Installment[]): number {
  return sum(installments.map((i) => i.amount));
}

export function installmentsMatch(installments: Installment[], total: number): boolean {
  return Math.abs(installmentsTotal(installments) - total) < 0.5;
}

// ---------- Descuento pronto pago (HU14) ----------
export function discountedAmount(amount: number, percent: number): number {
  return Math.round(amount * (1 - percent / 100));
}

export function isDiscountActive(tax: Tax, now: Date = new Date()): boolean {
  return !!tax.discount && tax.status !== "pagado" && daysUntil(tax.discount.deadline, now) >= 0;
}

/** Valor a pagar hoy: con descuento si está vigente. */
export function payableAmount(tax: Tax, now: Date = new Date()): number {
  return isDiscountActive(tax, now) ? discountedAmount(tax.amount, tax.discount!.percent) : tax.amount;
}

export function validateDiscount(percent: number, deadline: string) {
  const errors: { percent?: "percent"; deadline?: "required" } = {};
  if (!Number.isFinite(percent) || percent <= 0 || percent >= 100) errors.percent = "percent";
  if (isBlank(deadline)) errors.deadline = "required";
  return errors;
}

// ---------- Histórico y proyección (HU16) ----------
export interface TaxHistoryPoint {
  year: number;
  amount: number;
}

export function taxHistory(tax: Tax, taxes: Tax[]): TaxHistoryPoint[] {
  return taxes
    .filter((t) => t.type === tax.type && t.assetId === tax.assetId)
    .map((t) => ({ year: t.year, amount: t.payment?.amount ?? t.amount }))
    .sort((a, b) => a.year - b.year);
}

export function projectTax(history: TaxHistoryPoint[]) {
  if (history.length < 2) return { sufficient: false as const };
  // Crecimiento promedio año a año aplicado al último valor
  const growths: number[] = [];
  for (let i = 1; i < history.length; i++) {
    growths.push((history[i].amount - history[i - 1].amount) / history[i - 1].amount);
  }
  const avg = growths.reduce((a, b) => a + b, 0) / growths.length;
  const last = history.at(-1)!;
  const prev = history.at(-2)!;
  return {
    sufficient: true as const,
    nextYear: last.year + 1,
    estimate: Math.round(last.amount * (1 + avg)),
    yoy: variation(last.amount, prev.amount),
  };
}
