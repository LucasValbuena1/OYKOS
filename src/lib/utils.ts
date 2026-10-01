// Utilidades puras y reutilizables (sin React). Fáciles de probar.
import { intlLocale, type Locale } from "@/i18n/config";

export function uid(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

/** Une clases de Tailwind ignorando valores falsos. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// ---------- Fechas ----------
const DAY = 24 * 60 * 60 * 1000;

/** Convierte "YYYY-MM-DD" en Date local (evita el corrimiento UTC). */
export function parseDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(date.getDate(), lastDay));
  return d;
}

/** Días enteros entre hoy y la fecha (negativo si ya pasó). */
export function daysUntil(dateISO: string, now: Date = new Date()): number {
  return Math.round((startOfDay(parseDate(dateISO)).getTime() - startOfDay(now).getTime()) / DAY);
}

/** "YYYY-MM" de una fecha. */
export function toPeriod(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function periodToDate(period: string): Date {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export function shiftPeriod(period: string, months: number): string {
  return toPeriod(addMonths(periodToDate(period), months));
}

/** Lista de periodos YYYY-MM entre dos periodos, inclusive. */
export function periodRange(fromPeriod: string, toPeriodValue: string): string[] {
  const out: string[] = [];
  let current = fromPeriod;
  let guard = 0;
  while (current <= toPeriodValue && guard < 600) {
    out.push(current);
    current = shiftPeriod(current, 1);
    guard++;
  }
  return out;
}

// ---------- Formatos (dependen del idioma) ----------
export function formatMoney(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: digits }).format(value);
}

export function formatPercent(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  }).format(value / 100);
}

export function formatDate(
  value: string,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" },
): string {
  const d = parseDate(value);
  if (!value || Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale[locale], options).format(d);
}

export function formatDateTime(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function formatPeriod(period: string, locale: Locale, short = false): string {
  return new Intl.DateTimeFormat(intlLocale[locale], {
    month: short ? "short" : "long",
    year: short ? undefined : "numeric",
  }).format(periodToDate(period));
}

/** Reemplaza {variables} en un texto del diccionario. */
export function interpolate(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : `{${key}}`,
  );
}

/** Pluraliza con entradas { one, other } del diccionario. */
export function plural(
  entry: { one: string; other: string },
  count: number,
  vars: Record<string, string | number> = {},
): string {
  return interpolate(count === 1 ? entry.one : entry.other, { count, ...vars });
}

/** Suma de una lista de números con redondeo a 2 decimales. */
export function sum(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
}

/** Variación porcentual (null si la base es 0). */
export function variation(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Lee un archivo del navegador como data URL. */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const MAX_FILE_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export type FileError = "type" | "size" | null;

export function validateFile(file: { type: string; size: number }): FileError {
  if (!ACCEPTED_FILE_TYPES.includes(file.type)) return "type";
  if (file.size > MAX_FILE_BYTES) return "size";
  return null;
}

/** Nombre corto del día de la semana (0 = domingo). */
export function intlDay(index: number, bcp47: string): string {
  // 2023-01-01 fue domingo
  return new Intl.DateTimeFormat(bcp47, { weekday: "short" }).format(new Date(2023, 0, 1 + index));
}
