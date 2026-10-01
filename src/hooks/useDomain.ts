"use client";
// Hooks personalizados por dominio. Encapsulan la lógica de negocio
// (validaciones, cascadas, reglas) para que los componentes solo pinten.
import { useCallback, useMemo } from "react";
import type {
  AlertRule,
  AppNotification,
  Household,
  Incident,
  IncidentStatus,
  Invoice,
  Report,
  Service,
  Tax,
  Vehicle,
  VehicleExpense,
} from "@/types";
import {
  alertRulesStore,
  householdsStore,
  incidentsStore,
  invoicesStore,
  notificationsStore,
  reportsStore,
  selectedHouseholdStore,
  servicesStore,
  taxesStore,
  vehicleExpensesStore,
  vehiclesStore,
} from "@/data/stores";
import { useCollection, useStore } from "./useStore";
import { closeIncident, nextIncidentCode, transitionIncident, type IncidentInput } from "@/lib/domain/incidents";
import { evaluateRules } from "@/lib/domain/alerts";

// ---------- Hogares ----------
export function useHouseholds() {
  const households = useCollection<Household>(householdsStore, "h");
  const services = useCollection<Service>(servicesStore, "s");
  const invoices = useCollection<Invoice>(invoicesStore, "i");
  const rules = useCollection<AlertRule>(alertRulesStore, "r");
  const taxes = useCollection<Tax>(taxesStore, "t");
  const vehicles = useCollection<Vehicle>(vehiclesStore, "v");
  const [selected, setSelected] = useStore(selectedHouseholdStore);

  /** Elimina el hogar y TODA la información asociada (HU04). */
  const removeHousehold = useCallback(
    (id: string) => {
      const serviceIds = new Set(services.items.filter((s) => s.householdId === id).map((s) => s.id));
      invoices.removeWhere((i) => i.householdId === id);
      rules.removeWhere((r) => r.householdId === id);
      services.removeWhere((s) => s.householdId === id);
      taxes.removeWhere((t) => t.assetType === "hogar" && t.assetId === id);
      vehicles.removeWhere((v) => v.householdId === id);
      incidentsStore.set((prev) => prev.filter((inc) => !serviceIds.has(inc.serviceId)));
      households.remove(id);
      if (selected === id) setSelected(households.items.find((h) => h.id !== id)?.id ?? null);
    },
    [households, services, invoices, rules, taxes, vehicles, selected, setSelected],
  );

  return { ...households, removeHousehold };
}

/** Hogar seleccionado globalmente (selector del encabezado). */
export function useSelectedHousehold() {
  const [households] = useStore(householdsStore);
  const [selectedId, setSelectedId] = useStore(selectedHouseholdStore);
  const selected = households.find((h) => h.id === selectedId) ?? households[0] ?? null;
  return { households, selected, selectedId: selected?.id ?? null, setSelectedId };
}

// ---------- Servicios ----------
export function useServices() {
  const services = useCollection<Service>(servicesStore, "s");
  const invoices = useCollection<Invoice>(invoicesStore, "i");
  const rules = useCollection<AlertRule>(alertRulesStore, "r");

  /** Borra el servicio con sus facturas, alertas e incidentes (HU04). */
  const removeService = useCallback(
    (id: string) => {
      invoices.removeWhere((i) => i.serviceId === id);
      rules.removeWhere((r) => r.serviceId === id);
      incidentsStore.set((prev) => prev.filter((inc) => inc.serviceId !== id));
      services.remove(id);
    },
    [services, invoices, rules],
  );

  return { ...services, removeService };
}

// ---------- Facturas ----------
export function useInvoices() {
  const invoices = useCollection<Invoice>(invoicesStore, "i");
  const markPaid = useCallback(
    (id: string, paidAt: string) => invoices.update(id, { status: "pagada", paidAt }),
    [invoices],
  );
  return { ...invoices, markPaid };
}

// ---------- Impuestos ----------
export function useTaxes() {
  return useCollection<Tax>(taxesStore, "t");
}

// ---------- Vehículos ----------
export function useVehicles() {
  const vehicles = useCollection<Vehicle>(vehiclesStore, "v");
  const expenses = useCollection<VehicleExpense>(vehicleExpensesStore, "e");
  const taxes = useCollection<Tax>(taxesStore, "t");

  /** Elimina el vehículo y sus impuestos y gastos asociados (HU12). */
  const removeVehicle = useCallback(
    (id: string) => {
      expenses.removeWhere((e) => e.vehicleId === id);
      taxes.removeWhere((t) => t.assetType === "vehiculo" && t.assetId === id);
      vehicles.remove(id);
    },
    [vehicles, expenses, taxes],
  );

  return { ...vehicles, expenses, removeVehicle };
}

// ---------- Alertas y notificaciones ----------
export function useAlertRules() {
  return useCollection<AlertRule>(alertRulesStore, "r");
}

export function useNotifications() {
  const notifications = useCollection<AppNotification>(notificationsStore, "n");
  const sorted = useMemo(
    () => [...notifications.items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notifications.items],
  );
  const unread = sorted.filter((n) => !n.read).length;

  const markRead = useCallback((id: string) => notifications.update(id, { read: true }), [notifications]);
  const markAllRead = useCallback(
    () => notificationsStore.set((prev) => prev.map((n) => ({ ...n, read: true }))),
    [],
  );

  /** Evalúa reglas activas contra las facturas y agrega solo avisos nuevos. */
  const evaluate = useCallback((now: Date = new Date()) => {
    const created = evaluateRules(alertRulesStore.get(), invoicesStore.get(), notificationsStore.get(), now);
    if (created.length) notificationsStore.set((prev) => [...prev, ...created]);
    return created;
  }, []);

  return { items: sorted, unread, markRead, markAllRead, evaluate };
}

// ---------- Incidentes ----------
export function useIncidents() {
  const incidents = useCollection<Incident>(incidentsStore, "inc");

  const report = useCallback(
    (input: IncidentInput & { evidence?: Incident["evidence"] }, now: Date = new Date()) => {
      const createdAt = now.toISOString();
      return incidents.add({
        code: nextIncidentCode(incidentsStore.get(), now),
        serviceId: input.serviceId,
        type: input.type,
        startedAt: new Date(input.startedAt).toISOString(),
        description: input.description.trim(),
        filingNumber: input.filingNumber.trim() || undefined,
        evidence: input.evidence,
        status: "abierto",
        log: [{ status: "abierto", date: createdAt, comment: "" }],
        createdAt,
      });
    },
    [incidents],
  );

  const changeStatus = useCallback(
    (id: string, status: IncidentStatus, comment: string) => {
      const current = incidents.getById(id);
      if (current) incidents.update(id, transitionIncident(current, status, comment));
    },
    [incidents],
  );

  const close = useCallback(
    (id: string, solvedAt: string, comment: string) => {
      const current = incidents.getById(id);
      if (current) incidents.update(id, closeIncident(current, solvedAt, comment));
    },
    [incidents],
  );

  return { ...incidents, report, changeStatus, close };
}

// ---------- Reportes ----------
export function useReports() {
  return useCollection<Report>(reportsStore, "rep");
}
