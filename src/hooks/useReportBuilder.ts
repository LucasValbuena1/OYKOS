"use client";
// useReportBuilder — selección, validación, generación (con estado de carga) y
// exportación de reportes (Felipe · F2: HU05–HU08).
import { useCallback, useMemo, useState } from "react";
import type { Report } from "@/types";
import { useHouseholds, useInvoices, useReports, useServices, useTaxes, useVehicles } from "./useDomain";
import { wait } from "./useUi";
import { generateReportData, quickRange, validateSelection, type QuickRange, type ReportSelection } from "@/lib/domain/reports";

export const REPORT_DELAY_MS = 900;

export function useReportBuilder(initial: Partial<ReportSelection> = {}, delayMs = REPORT_DELAY_MS) {
  const households = useHouseholds();
  const invoices = useInvoices();
  const services = useServices();
  const taxes = useTaxes();
  const vehicles = useVehicles();
  const reports = useReports();

  const [selection, setSelection] = useState<ReportSelection>(() => ({
    householdId: initial.householdId ?? households.items[0]?.id ?? "",
    type: initial.type ?? "gastos",
    ...quickRange("3m"),
    ...initial,
  }));
  const [generating, setGenerating] = useState(false);
  const [current, setCurrent] = useState<Report | null>(null);

  const error = validateSelection(selection);

  const update = useCallback((changes: Partial<ReportSelection>) => setSelection((s) => ({ ...s, ...changes })), []);
  const applyQuickRange = useCallback((r: QuickRange) => setSelection((s) => ({ ...s, ...quickRange(r) })), []);

  const generate = useCallback(async () => {
    if (validateSelection(selection)) return null;
    setGenerating(true);
    try {
      await wait(delayMs);
      const vehicleIds = vehicles.items.filter((v) => v.householdId === selection.householdId).map((v) => v.id);
      const data = generateReportData(selection, invoices.items, services.items, taxes.items, vehicleIds);
      const report = reports.add({ ...selection, createdAt: new Date().toISOString(), data });
      setCurrent(report);
      return report;
    } finally {
      setGenerating(false);
    }
  }, [selection, delayMs, invoices.items, services.items, taxes.items, vehicles.items, reports]);

  const history = useMemo(() => [...reports.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [reports.items]);

  return {
    selection,
    update,
    applyQuickRange,
    error,
    canGenerate: !error && !generating,
    generating,
    generate,
    current,
    open: setCurrent,
    history,
    removeReport: (id: string) => {
      reports.remove(id);
      setCurrent((c) => (c?.id === id ? null : c));
    },
    households: households.items,
  };
}
