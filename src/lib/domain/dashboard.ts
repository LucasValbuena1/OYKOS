// Cálculos del dashboard de consumo (Gabriela · Funcionalidad 2).
import type { Invoice, Service, ServiceType } from "@/types";
import { periodRange, shiftPeriod, sum, toPeriod, variation } from "@/lib/utils";
import { invoiceDisplayStatus } from "./invoices";

export const VARIATION_THRESHOLD = 15; // % a partir del cual se resalta
export const MIN_PROJECTION_HISTORY = 3; // meses mínimos para proyectar

export type PeriodPreset = "month" | "quarter" | "year" | "custom";

export interface ConsumptionFilters {
  serviceType: ServiceType | "all";
  preset: PeriodPreset;
  from?: string; // YYYY-MM, solo para custom
  to?: string;
}

export const defaultConsumptionFilters: ConsumptionFilters = { serviceType: "all", preset: "month" };

export function isDefaultFilters(f: ConsumptionFilters) {
  return f.serviceType === "all" && f.preset === "month";
}

/** Periodos (YYYY-MM) que cubre un filtro. */
export function periodsForFilter(filters: ConsumptionFilters, now: Date = new Date()): string[] {
  const current = toPeriod(now);
  switch (filters.preset) {
    case "month":
      return [current];
    case "quarter":
      return periodRange(shiftPeriod(current, -2), current);
    case "year":
      return periodRange(shiftPeriod(current, -11), current);
    case "custom": {
      if (!filters.from || !filters.to || filters.from > filters.to) return [];
      return periodRange(filters.from, filters.to);
    }
  }
}

function typeMap(services: Service[]) {
  return new Map(services.map((s) => [s.id, s.type] as const));
}

export function invoicesForHousehold(invoices: Invoice[], householdId: string) {
  return invoices.filter((i) => i.householdId === householdId);
}

export interface ServiceBreakdown {
  serviceType: ServiceType;
  amount: number;
  consumption: number;
  share: number; // % del total
}

export function breakdownByService(invoices: Invoice[], services: Service[]): ServiceBreakdown[] {
  const types = typeMap(services);
  const acc = new Map<ServiceType, { amount: number; consumption: number }>();
  for (const inv of invoices) {
    const t = types.get(inv.serviceId);
    if (!t) continue;
    const cur = acc.get(t) ?? { amount: 0, consumption: 0 };
    cur.amount += inv.amount;
    cur.consumption += inv.consumption;
    acc.set(t, cur);
  }
  const total = sum([...acc.values()].map((v) => v.amount));
  return [...acc.entries()]
    .map(([serviceType, v]) => ({
      serviceType,
      amount: v.amount,
      consumption: v.consumption,
      share: total ? Math.round((v.amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/** Aplica filtros de servicio y periodo (HU06). */
export function applyConsumptionFilters(
  invoices: Invoice[],
  services: Service[],
  filters: ConsumptionFilters,
  now: Date = new Date(),
): Invoice[] {
  const types = typeMap(services);
  const periods = new Set(periodsForFilter(filters, now));
  return invoices.filter(
    (i) =>
      periods.has(i.period) && (filters.serviceType === "all" || types.get(i.serviceId) === filters.serviceType),
  );
}

export function dashboardSummary(
  invoices: Invoice[],
  services: Service[],
  filters: ConsumptionFilters,
  now: Date = new Date(),
) {
  const filtered = applyConsumptionFilters(invoices, services, filters, now);
  const upcoming = invoices
    .filter((i) => i.status === "pendiente")
    .map((i) => ({ invoice: i, status: invoiceDisplayStatus(i, now) }))
    .filter((x) => x.status === "vencida" || x.status === "por_vencer")
    .sort((a, b) => a.invoice.dueDate.localeCompare(b.invoice.dueDate));
  return {
    total: sum(filtered.map((i) => i.amount)),
    count: filtered.length,
    breakdown: breakdownByService(filtered, services),
    upcoming,
  };
}

export interface MonthPoint {
  period: string;
  amount: number;
  consumption: number;
}

/** Serie de los últimos N meses (incluye meses sin datos en 0). */
export function monthlySeries(invoices: Invoice[], months = 12, now: Date = new Date()): MonthPoint[] {
  const current = toPeriod(now);
  return periodRange(shiftPeriod(current, -(months - 1)), current).map((period) => {
    const inPeriod = invoices.filter((i) => i.period === period);
    return {
      period,
      amount: sum(inPeriod.map((i) => i.amount)),
      consumption: sum(inPeriod.map((i) => i.consumption)),
    };
  });
}

export type VariationKind = "increase" | "saving" | "neutral";

export function classifyVariation(value: number | null, threshold = VARIATION_THRESHOLD): VariationKind {
  if (value === null) return "neutral";
  if (value >= threshold) return "increase";
  if (value <= -threshold) return "saving";
  return "neutral";
}

/** Comparativa histórica (HU07). */
export function historicalComparison(invoices: Invoice[], now: Date = new Date()) {
  const series = monthlySeries(invoices, 12, now);
  const available = series.filter((p) => p.amount > 0);
  const byPeriod = new Map(invoices.map((i) => [i.period, 0]));
  for (const i of invoices) byPeriod.set(i.period, (byPeriod.get(i.period) ?? 0) + i.amount);
  const current = toPeriod(now);
  const currentAmount = byPeriod.get(current) ?? 0;
  const prevMonth = byPeriod.get(shiftPeriod(current, -1)) ?? 0;
  const lastYear = byPeriod.get(shiftPeriod(current, -12)) ?? 0;
  const vsPrevious = variation(currentAmount, prevMonth);
  const vsLastYear = variation(currentAmount, lastYear);
  return {
    series: series.filter((p) => p.amount > 0 || available.length === 0),
    monthsAvailable: available.length,
    limited: available.length < 12,
    vsPrevious,
    vsLastYear,
    vsPreviousKind: classifyVariation(vsPrevious),
    vsLastYearKind: classifyVariation(vsLastYear),
  };
}

export interface ServiceProjection {
  serviceId: string;
  serviceType: ServiceType;
  sufficient: boolean;
  monthsUsed: number;
  estimate: number;
  estimatedConsumption: number;
  previous: number;
  difference: number;
}

/** Proyección de la próxima factura por servicio (HU08 Gabriela / HU06 Alejandro). */
export function projectNextInvoice(
  serviceId: string,
  serviceType: ServiceType,
  invoices: Invoice[],
  window = 3,
): ServiceProjection {
  const history = invoices
    .filter((i) => i.serviceId === serviceId)
    .sort((a, b) => a.period.localeCompare(b.period));
  const monthsUsed = Math.min(history.length, window);
  const previous = history.at(-1)?.amount ?? 0;
  if (history.length < MIN_PROJECTION_HISTORY) {
    return {
      serviceId,
      serviceType,
      sufficient: false,
      monthsUsed: history.length,
      estimate: 0,
      estimatedConsumption: 0,
      previous,
      difference: 0,
    };
  }
  const recent = history.slice(-window);
  const estimate = Math.round(sum(recent.map((i) => i.amount)) / recent.length);
  const estimatedConsumption = Math.round((sum(recent.map((i) => i.consumption)) / recent.length) * 10) / 10;
  return {
    serviceId,
    serviceType,
    sufficient: true,
    monthsUsed,
    estimate,
    estimatedConsumption,
    previous,
    difference: estimate - previous,
  };
}
