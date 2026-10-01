// Reglas de negocio de Vehículos (Gabriela · Funcionalidad 3).
import type { Tax, Vehicle, VehicleExpense, VehicleType } from "@/types";
import { parseDate, sum } from "@/lib/utils";
import { isBlank, type FormErrors } from "@/lib/validation";

export const VEHICLE_TYPES: VehicleType[] = ["automovil", "camioneta", "moto", "otro"];

/** Placas colombianas: carros ABC123, motos ABC12D. */
export const PLATE_RE = /^[A-Z]{3}\d{3}$|^[A-Z]{3}\d{2}[A-Z]$/;

export const normalizePlate = (plate: string) => plate.toUpperCase().replace(/[\s-]/g, "");

export const formatPlate = (plate: string) => {
  const p = normalizePlate(plate);
  return p.length === 6 ? `${p.slice(0, 3)} ${p.slice(3)}` : p;
};

export type VehicleInput = Omit<Vehicle, "id" | "createdAt">;

export const emptyVehicle = (householdId = ""): VehicleInput => ({
  plate: "",
  brand: "",
  model: "",
  year: new Date().getFullYear(),
  type: "automovil",
  householdId,
});

export function validateVehicle(
  input: VehicleInput,
  vehicles: Vehicle[],
  editingId?: string,
  now: Date = new Date(),
): FormErrors<VehicleInput> {
  const errors: FormErrors<VehicleInput> = {};
  const plate = normalizePlate(input.plate);
  if (isBlank(plate)) errors.plate = "required";
  else if (!PLATE_RE.test(plate)) errors.plate = "plate";
  else if (vehicles.some((v) => v.id !== editingId && normalizePlate(v.plate) === plate)) errors.plate = "plateTaken";
  if (isBlank(input.brand)) errors.brand = "required";
  if (isBlank(input.model)) errors.model = "required";
  const maxYear = now.getFullYear() + 1;
  if (!Number.isInteger(input.year) || input.year < 1950 || input.year > maxYear) errors.year = "yearRange";
  if (!VEHICLE_TYPES.includes(input.type)) errors.type = "required";
  if (isBlank(input.householdId)) errors.householdId = "required";
  return errors;
}

export interface VehicleCost {
  taxes: number;
  expenses: number;
  total: number;
  taxItems: Tax[];
  expenseItems: VehicleExpense[];
}

const inRange = (dateISO: string, from: string, to: string) => {
  const d = parseDate(dateISO).getTime();
  return d >= parseDate(from).getTime() && d <= parseDate(to).getTime();
};

/** Costo acumulado de un vehículo en un periodo (HU13). */
export function vehicleCost(
  vehicleId: string,
  taxes: Tax[],
  expenses: VehicleExpense[],
  from: string,
  to: string,
): VehicleCost {
  const taxItems = taxes.filter((t) => t.assetType === "vehiculo" && t.assetId === vehicleId && inRange(t.dueDate, from, to));
  const expenseItems = expenses.filter((e) => e.vehicleId === vehicleId && inRange(e.date, from, to));
  const taxTotal = sum(taxItems.map((t) => t.payment?.amount ?? t.amount));
  const expTotal = sum(expenseItems.map((e) => e.amount));
  return { taxes: taxTotal, expenses: expTotal, total: taxTotal + expTotal, taxItems, expenseItems };
}
