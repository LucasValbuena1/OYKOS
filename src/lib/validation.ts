// Validaciones genéricas. Devuelven la CLAVE del mensaje (no el texto) para
// que la interfaz lo traduzca con el diccionario del idioma activo.
export type ValidationKey =
  | "required"
  | "positive"
  | "integer"
  | "email"
  | "phone"
  | "passwordWeak"
  | "passwordMismatch"
  | "passwordSame"
  | "emailTaken"
  | "dateOrder"
  | "futureDate"
  | "plate"
  | "plateTaken"
  | "yearRange"
  | "stratum"
  | "cutoffDay"
  | "duplicateService"
  | "percent"
  | "minLength"
  | "code";

export type FormErrors<T> = Partial<Record<keyof T, ValidationKey>>;

export const isBlank = (v: unknown) =>
  v === undefined || v === null || (typeof v === "string" && v.trim() === "");

export const isPositiveNumber = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(v);
  return !isBlank(v) && Number.isFinite(n) && n > 0;
};

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v: string) => EMAIL_RE.test(v.trim());

/** Teléfono: dígitos, espacios, guiones y + opcional; entre 7 y 15 dígitos. */
export const isPhone = (v: string) => {
  if (!/^\+?[\d\s-]+$/.test(v.trim())) return false;
  const digits = v.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
};

export interface PasswordStrength {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  symbol: boolean;
}

export function passwordStrength(pwd: string): PasswordStrength {
  return {
    length: pwd.length >= 8,
    upper: /[A-Z]/.test(pwd),
    lower: /[a-z]/.test(pwd),
    number: /\d/.test(pwd),
    symbol: /[^A-Za-z0-9]/.test(pwd),
  };
}

export const isStrongPassword = (pwd: string) =>
  Object.values(passwordStrength(pwd)).every(Boolean);

export const hasErrors = <T,>(errors: FormErrors<T>) => Object.values(errors).some(Boolean);
