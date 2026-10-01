"use client";
// useDashboard — combina facturas, servicios y filtros del hogar seleccionado
// para el módulo de monitoreo (Gabriela · F2: HU05–HU08).
import { useMemo, useState } from "react";
import { useInvoices, useServices, useAlertRules } from "./useDomain";
import {
  dashboardSummary,
  defaultConsumptionFilters,
  historicalComparison,
  invoicesForHousehold,
  isDefaultFilters,
  periodsForFilter,
  projectNextInvoice,
  type ConsumptionFilters,
} from "@/lib/domain/dashboard";

export function useConsumptionFilters(initial: ConsumptionFilters = defaultConsumptionFilters) {
  const [filters, setFilters] = useState<ConsumptionFilters>(initial);
  return {
    filters,
    setServiceType: (serviceType: ConsumptionFilters["serviceType"]) => setFilters((f) => ({ ...f, serviceType })),
    setPreset: (preset: ConsumptionFilters["preset"]) => setFilters((f) => ({ ...f, preset })),
    setRange: (from: string, to: string) => setFilters((f) => ({ ...f, preset: "custom", from, to })),
    clear: () => setFilters(defaultConsumptionFilters),
    isDefault: isDefaultFilters(filters),
  };
}

export function useDashboard(householdId: string | null, filters: ConsumptionFilters, now: Date = new Date()) {
  const invoices = useInvoices();
  const services = useServices();
  const rules = useAlertRules();
  const nowKey = now.toDateString();

  return useMemo(() => {
    const today = new Date(nowKey);
    const householdServices = services.items.filter((s) => s.householdId === householdId);
    const householdInvoices = householdId ? invoicesForHousehold(invoices.items, householdId) : [];
    const summary = dashboardSummary(householdInvoices, householdServices, filters, today);
    const typeFiltered =
      filters.serviceType === "all"
        ? householdInvoices
        : householdInvoices.filter((i) => householdServices.find((s) => s.id === i.serviceId)?.type === filters.serviceType);
    const history = historicalComparison(typeFiltered, today);
    const projections = householdServices
      .filter((s) => filters.serviceType === "all" || s.type === filters.serviceType)
      .map((s) => projectNextInvoice(s.id, s.type, householdInvoices));
    const projectedTotal = projections.filter((p) => p.sufficient).reduce((a, p) => a + p.estimate, 0);
    const recent = [...householdInvoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
    const paidOnTime = householdInvoices.filter((i) => i.status === "pagada" && (!i.paidAt || i.paidAt <= i.dueDate)).length;
    const healthScore = householdInvoices.length ? Math.round((paidOnTime / householdInvoices.length) * 100) : 0;
    return {
      hasInvoices: householdInvoices.length > 0,
      services: householdServices,
      summary,
      history,
      projections,
      projectedTotal,
      recent,
      healthScore,
      activeAlerts: rules.items.filter((r) => r.active && r.householdId === householdId).length,
      periods: periodsForFilter(filters, today),
    };
  }, [invoices.items, services.items, rules.items, householdId, filters, nowKey]);
}
