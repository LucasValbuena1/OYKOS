// Una "tabla" persistente por colección. Es la única capa que sabe dónde se
// guardan los datos: en el ciclo 2 estos stores se reemplazan por llamadas a
// la API sin que cambien los hooks ni los componentes.
import type {
  AlertRule,
  DueReminder,
  ReminderSettings,
  AppNotification,
  Household,
  Incident,
  Invoice,
  Report,
  Service,
  Tax,
  Vehicle,
  VehicleExpense,
} from "@/types";
import { createPersistentStore } from "@/lib/store";
import {
  seedAlertRules,
  seedHouseholds,
  seedIncidents,
  seedInvoices,
  seedServices,
  seedTaxes,
  seedVehicleExpenses,
  seedVehicles,
} from "./seed";


export const householdsStore = createPersistentStore<Household[]>("households", () => seedHouseholds());
export const servicesStore = createPersistentStore<Service[]>("services", () => seedServices());
export const invoicesStore = createPersistentStore<Invoice[]>("invoices", () => seedInvoices());
export const taxesStore = createPersistentStore<Tax[]>("taxes", () => seedTaxes());
export const vehiclesStore = createPersistentStore<Vehicle[]>("vehicles", () => seedVehicles());
export const vehicleExpensesStore = createPersistentStore<VehicleExpense[]>("vehicle-expenses", () => seedVehicleExpenses());
export const alertRulesStore = createPersistentStore<AlertRule[]>("alert-rules", () => seedAlertRules());
export const notificationsStore = createPersistentStore<AppNotification[]>("notifications", () => []);
export const incidentsStore = createPersistentStore<Incident[]>("incidents", () => seedIncidents());
export const reportsStore = createPersistentStore<Report[]>("reports", () => []);
/** Datos de perfil propios de Oykos por usuario de Auth0 (teléfono, foto, nombre visible). */
export const profilesStore = createPersistentStore<Record<string, { name?: string; phone?: string; photo?: string }>>(
  "profiles",
  () => ({}),
);
/** HU17: avisos de vencimiento y su configuración. */
export const dueRemindersStore = createPersistentStore<DueReminder[]>("due-reminders", () => []);
export const reminderSettingsStore = createPersistentStore<ReminderSettings>("reminder-settings", () => ({ enabled: true, daysBefore: [5, 1] }));
/** HU08: recomendaciones descartadas por hogar. */
export const dismissedRecommendationsStore = createPersistentStore<Record<string, string[]>>("dismissed-recommendations", () => ({}));
/** Respuestas de Claude guardadas por huella de datos: evita llamar a la API en cada visita. */
export const assistantCacheStore = createPersistentStore<Record<string, unknown>>("assistant-cache", () => ({}));
export const selectedHouseholdStore = createPersistentStore<string | null>("selected-household", () => "h1");
