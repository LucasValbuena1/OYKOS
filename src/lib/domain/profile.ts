// Validación del perfil propio de Oykos (Lucas · HU10). El correo y la
// contraseña los administra Auth0; aquí solo nombre visible y teléfono.
import { isBlank, isPhone, type FormErrors } from "@/lib/validation";

export interface ProfileInput {
  name: string;
  phone: string;
}

export function validateProfile(input: ProfileInput): FormErrors<ProfileInput> {
  const errors: FormErrors<ProfileInput> = {};
  if (isBlank(input.name)) errors.name = "required";
  else if (input.name.trim().length < 2) errors.name = "minLength";
  if (!isBlank(input.phone) && !isPhone(input.phone)) errors.phone = "phone";
  return errors;
}
