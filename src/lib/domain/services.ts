// Reglas de negocio de Servicios públicos (Lucas · Funcionalidad 1).
import type { Invoice, Service, ServiceType } from "@/types";
import { isBlank, type FormErrors } from "@/lib/validation";

export const SERVICE_TYPES: ServiceType[] = ["agua", "energia", "gas", "internet", "aseo"];

/** Empresas prestadoras sugeridas (Colombia). El usuario también puede escribir otra. */
export const PROVIDERS: Record<ServiceType, string[]> = {
  agua: ["Acueducto de Bogotá (EAAB)", "EPM", "Aguas de Cartagena"],
  energia: ["Enel Colombia", "EPM", "Air-e", "Celsia"],
  gas: ["Vanti", "EPM", "Gases del Caribe"],
  internet: ["ETB", "Claro", "Movistar", "Tigo"],
  aseo: ["Promoambiental", "Bogotá Limpia", "Ciudad Limpia"],
};

/** Unidad de consumo por tipo de servicio. */
export const SERVICE_UNITS: Record<ServiceType, string> = {
  agua: "m³",
  energia: "kWh",
  gas: "m³",
  internet: "GB",
  aseo: "kg",
};

export type ServiceInput = Omit<Service, "id" | "createdAt">;

export const emptyService = (householdId = ""): ServiceInput => ({
  householdId,
  type: "agua",
  provider: "",
  accountNumber: "",
  cutoffDay: 15,
});

export function isDuplicateService(input: ServiceInput, services: Service[], editingId?: string): boolean {
  return services.some(
    (s) =>
      s.id !== editingId &&
      s.householdId === input.householdId &&
      s.type === input.type &&
      s.accountNumber.trim().toLowerCase() === input.accountNumber.trim().toLowerCase(),
  );
}

export function validateService(
  input: ServiceInput,
  services: Service[],
  editingId?: string,
): FormErrors<ServiceInput> {
  const errors: FormErrors<ServiceInput> = {};
  if (isBlank(input.householdId)) errors.householdId = "required";
  if (!SERVICE_TYPES.includes(input.type)) errors.type = "required";
  if (isBlank(input.provider)) errors.provider = "required";
  if (isBlank(input.accountNumber)) errors.accountNumber = "required";
  if (!Number.isInteger(input.cutoffDay) || input.cutoffDay < 1 || input.cutoffDay > 31) errors.cutoffDay = "cutoffDay";
  if (!errors.accountNumber && !errors.type && isDuplicateService(input, services, editingId)) {
    errors.accountNumber = "duplicateService";
  }
  return errors;
}

/** Última factura (por periodo) de un servicio. */
export function lastInvoice(serviceId: string, invoices: Invoice[]): Invoice | undefined {
  return invoices
    .filter((i) => i.serviceId === serviceId)
    .sort((a, b) => b.period.localeCompare(a.period))[0];
}

export function servicesByHousehold(householdId: string | null, services: Service[]): Service[] {
  if (!householdId) return services;
  return services.filter((s) => s.householdId === householdId);
}
