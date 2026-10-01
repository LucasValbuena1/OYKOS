// Reglas de negocio de Hogares (Felipe · Funcionalidad 1).
import type { Household, PropertyType, Service } from "@/types";
import { isBlank, type FormErrors } from "@/lib/validation";

export const PROPERTY_TYPES: PropertyType[] = ["casa", "apartamento", "local"];
export const STRATA = [1, 2, 3, 4, 5, 6];

export type HouseholdInput = Omit<Household, "id" | "createdAt">;

export const emptyHousehold: HouseholdInput = {
  name: "",
  type: "casa",
  address: "",
  city: "",
  stratum: 3,
};

export function validateHousehold(input: HouseholdInput): FormErrors<HouseholdInput> {
  const errors: FormErrors<HouseholdInput> = {};
  if (isBlank(input.name)) errors.name = "required";
  else if (input.name.trim().length < 3) errors.name = "minLength";
  if (!PROPERTY_TYPES.includes(input.type)) errors.type = "required";
  if (isBlank(input.address)) errors.address = "required";
  if (isBlank(input.city)) errors.city = "required";
  if (!Number.isInteger(input.stratum) || input.stratum < 1 || input.stratum > 6) errors.stratum = "stratum";
  return errors;
}

export function countServices(householdId: string, services: Service[]): number {
  return services.filter((s) => s.householdId === householdId).length;
}
