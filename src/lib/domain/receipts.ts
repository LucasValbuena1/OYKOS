// Escáner de recibos (Alejandro · F3): normalización de lo que devuelve la IA,
// validación, asociación al servicio y armado de la factura.
import type { ExtractedField, ReceiptExtraction, Service, ServiceType } from "@/types";
import { daysUntil, toISODate } from "@/lib/utils";

export const LOW_CONFIDENCE = 0.7;
export const RECEIPT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024;

export type ReceiptFileError = "type" | "size" | null;

/** HU10: valida formato (JPG, PNG o PDF) y tamaño máximo. */
export function validateReceiptFile(file: { type: string; size: number }): ReceiptFileError {
  if (!(RECEIPT_TYPES as readonly string[]).includes(file.type)) return "type";
  if (file.size > MAX_RECEIPT_BYTES) return "size";
  return null;
}

const MONTHS: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

/**
 * HU12: normaliza fechas a YYYY-MM-DD. Acepta ISO, DD/MM/YYYY, DD-MM-YYYY y
 * "15 oct 2026" / "oct 15, 2026". Devuelve null si no la entiende.
 */
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim().toLowerCase();
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return build(+m[1], +m[2], +m[3]);
  m = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return build(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = v.match(/^(\d{1,2})\s*(?:de\s+)?([a-zñ]{3,})\.?\s*(?:de\s+)?(\d{4})$/);
  if (m && MONTHS[m[2].slice(0, 3)]) return build(+m[3], MONTHS[m[2].slice(0, 3)], +m[1]);
  m = v.match(/^([a-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m && MONTHS[m[1].slice(0, 3)]) return build(+m[3], MONTHS[m[1].slice(0, 3)], +m[2]);
  return null;
}

function build(y: number, mo: number, d: number): string | null {
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return toISODate(date);
}

const clampConfidence = (c: unknown) => {
  const n = typeof c === "number" ? c : Number(c);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
};

function field<T>(raw: unknown, parse: (v: unknown) => T | null): ExtractedField<T> {
  const obj = (raw && typeof raw === "object" ? raw : { value: raw, confidence: raw == null ? 0 : 0.5 }) as { value?: unknown; confidence?: unknown };
  const value = obj.value === undefined || obj.value === null || obj.value === "" ? null : parse(obj.value);
  return { value, confidence: value === null ? 0 : clampConfidence(obj.confidence) };
}

const SERVICE_TYPES: ServiceType[] = ["agua", "energia", "gas", "internet", "aseo"];

const toNumber = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const clean = String(v).replace(/[^\d,.-]/g, "");
  // "1.234.500" o "1,234,500" → miles; "1234,5" → decimal
  const normalized = /^\d{1,3}([.,]\d{3})+$/.test(clean) ? clean.replace(/[.,]/g, "") : clean.replace(",", ".");
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Limpia y valida la respuesta cruda de la IA (nunca se confía en ella). */
export function sanitizeExtraction(raw: unknown): ReceiptExtraction {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const text = (v: unknown) => {
    const s = String(v).trim();
    return s ? s.slice(0, 120) : null;
  };
  return {
    provider: field(r.provider, text),
    reference: field(r.reference, (v) => text(v)?.replace(/\s+/g, "") ?? null),
    amount: field(r.amount, toNumber),
    cutoffDate: field(r.cutoffDate, (v) => normalizeDate(String(v))),
    dueDate: field(r.dueDate, (v) => normalizeDate(String(v))),
    period: field(r.period, (v) => {
      const s = String(v).trim();
      if (/^\d{4}-\d{2}$/.test(s)) return s;
      const d = normalizeDate(s);
      return d ? d.slice(0, 7) : null;
    }),
    consumption: field(r.consumption, toNumber),
    serviceType: field(r.serviceType, (v) => {
      const s = String(v).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
      if (s.includes("energ") || s.includes("luz") || s.includes("electr")) return "energia";
      if (s.includes("agua") || s.includes("acueduct") || s.includes("water")) return "agua";
      if (s.includes("gas")) return "gas";
      if (s.includes("internet") || s.includes("fibra")) return "internet";
      if (s.includes("aseo") || s.includes("basura")) return "aseo";
      return (SERVICE_TYPES as string[]).includes(s) ? (s as ServiceType) : null;
    }),
  };
}

export type ExtractionKey = keyof ReceiptExtraction;

/** HU11/HU13: campos a revisar primero (vacíos o con baja confianza). */
export function fieldsToReview(ex: ReceiptExtraction): ExtractionKey[] {
  return (Object.keys(ex) as ExtractionKey[]).filter((k) => ex[k].value === null || ex[k].confidence < LOW_CONFIDENCE);
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** HU11: asocia el recibo al servicio del hogar cuando la empresa coincide. */
export function matchService(provider: string | null, serviceType: ServiceType | null, services: Service[]): Service | undefined {
  if (!provider) return serviceType ? services.find((s) => s.type === serviceType) : undefined;
  const p = norm(provider);
  const tokens = p.split(" ").filter((t) => t.length > 2);
  const candidates = services.filter((s) => {
    const sp = norm(s.provider);
    return sp.includes(p) || p.includes(sp) || tokens.some((t) => sp.split(" ").includes(t));
  });
  if (candidates.length <= 1) return candidates[0];
  return candidates.find((s) => s.type === serviceType) ?? candidates[0];
}

/** HU12: la fecha límite ya pasó. */
export const isOverdue = (dueDate: string | null, now: Date = new Date()) => !!dueDate && daysUntil(dueDate, now) < 0;
