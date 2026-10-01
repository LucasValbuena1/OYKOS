// Reglas de incidentes / fallas (Lucas · Funcionalidad 2).
import type { Incident, IncidentStatus, IncidentType } from "@/types";
import { isBlank, type FormErrors } from "@/lib/validation";

export const INCIDENT_TYPES: IncidentType[] = ["corte", "falla", "cobro"];
export const INCIDENT_STATUSES: IncidentStatus[] = ["abierto", "en_gestion", "resuelto", "cerrado"];
/** Estados que el usuario puede elegir al actualizar (HU07); "cerrado" se hace con HU08. */
export const EDITABLE_STATUSES: IncidentStatus[] = ["abierto", "en_gestion", "resuelto"];

export const isActive = (i: Incident) => i.status !== "cerrado";

export interface IncidentFilters {
  status: "all" | IncidentStatus;
  serviceId: "all" | string;
  showClosed: boolean;
}

export const defaultIncidentFilters: IncidentFilters = { status: "all", serviceId: "all", showClosed: false };

const ORDER: Record<IncidentStatus, number> = { abierto: 0, en_gestion: 1, resuelto: 2, cerrado: 3 };

/** Abiertos primero; dentro del mismo estado, el más reciente primero. */
export function sortIncidents(list: Incident[]): Incident[] {
  return [...list].sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.createdAt.localeCompare(a.createdAt));
}

export function filterIncidents(list: Incident[], filters: IncidentFilters): Incident[] {
  return sortIncidents(
    list
      .filter((i) => filters.showClosed || filters.status === "cerrado" || isActive(i))
      .filter((i) => filters.status === "all" || i.status === filters.status)
      .filter((i) => filters.serviceId === "all" || i.serviceId === filters.serviceId),
  );
}

export function countByStatus(list: Incident[]) {
  return {
    abierto: list.filter((i) => i.status === "abierto").length,
    en_gestion: list.filter((i) => i.status === "en_gestion").length,
    resuelto: list.filter((i) => i.status === "resuelto").length,
    cerrado: list.filter((i) => i.status === "cerrado").length,
  };
}

export interface IncidentInput {
  serviceId: string;
  type: IncidentType;
  startedAt: string; // datetime-local
  description: string;
  filingNumber: string;
}

export const emptyIncident = (): IncidentInput => ({
  serviceId: "",
  type: "corte",
  startedAt: "",
  description: "",
  filingNumber: "",
});

export function validateIncident(input: IncidentInput, now: Date = new Date()): FormErrors<IncidentInput> {
  const errors: FormErrors<IncidentInput> = {};
  if (isBlank(input.serviceId)) errors.serviceId = "required";
  if (!INCIDENT_TYPES.includes(input.type)) errors.type = "required";
  if (isBlank(input.startedAt)) errors.startedAt = "required";
  else if (new Date(input.startedAt).getTime() > now.getTime()) errors.startedAt = "futureDate";
  if (isBlank(input.description)) errors.description = "required";
  else if (input.description.trim().length < 10) errors.description = "minLength";
  return errors;
}

export function nextIncidentCode(list: Incident[], now: Date = new Date()): string {
  const year = now.getFullYear();
  const max = list
    .map((i) => Number(i.code.split("-").at(-1)))
    .filter((n) => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0);
  return `INC-${year}-${String(max + 1).padStart(3, "0")}`;
}

/** Cambia el estado agregando la entrada a la bitácora (HU07). */
export function transitionIncident(
  incident: Incident,
  status: IncidentStatus,
  comment: string,
  now: Date = new Date(),
): Incident {
  return {
    ...incident,
    status,
    log: [...incident.log, { status, date: now.toISOString(), comment: comment.trim() }],
  };
}

/** Cierra el incidente con fecha de solución y comentario (HU08). */
export function closeIncident(incident: Incident, solvedAt: string, comment: string, now: Date = new Date()): Incident {
  return {
    ...transitionIncident(incident, "cerrado", comment, now),
    closedAt: solvedAt,
  };
}

/** Bitácora en orden cronológico ascendente. */
export const chronologicalLog = (incident: Incident) =>
  [...incident.log].sort((a, b) => a.date.localeCompare(b.date));
