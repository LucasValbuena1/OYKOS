// Asistente IA (Alejandro · F2): cálculos deterministas que alimentan a Claude
// (los números los calcula la app; Claude redacta y recomienda).
//   HU06 predicción · HU07 perfil · HU08 recomendaciones · HU09 score
import type { ConsumptionLevel, Household, Invoice, Service, ServiceType } from "@/types";
import { periodRange, shiftPeriod, sum, toPeriod } from "@/lib/utils";
import { MIN_PROJECTION_HISTORY, projectNextInvoice, type ServiceProjection } from "./dashboard";

/** Gasto mensual de referencia por estrato (COP) — hogares con patrones similares. */
export const STRATUM_REFERENCE: Record<number, number> = {
  1: 120_000,
  2: 180_000,
  3: 260_000,
  4: 340_000,
  5: 450_000,
  6: 560_000,
};

/** Consumo mensual de referencia por servicio (promedios de un hogar colombiano). */
export const CONSUMPTION_REFERENCE: Partial<Record<ServiceType, number>> = {
  energia: 200, // kWh
  agua: 20, // m³
  gas: 25, // m³
};

/** Peso de cada servicio en el score de sostenibilidad. */
export const SCORE_WEIGHTS: Partial<Record<ServiceType, number>> = { energia: 0.45, agua: 0.35, gas: 0.2 };

export const SCORE_RANGES = [
  { key: "bajo", min: 0, max: 39 },
  { key: "medio", min: 40, max: 69 },
  { key: "alto", min: 70, max: 100 },
] as const;

export type ScoreRange = (typeof SCORE_RANGES)[number]["key"];

export interface AssistantFacts {
  household: Pick<Household, "id" | "name" | "city" | "stratum">;
  months: number;
  monthly: { period: string; amount: number }[];
  services: { id: string; type: ServiceType; provider: string; avgAmount: number; avgConsumption: number; lastConsumption: number }[];
}

function monthsWithData(invoices: Invoice[]) {
  return [...new Set(invoices.map((i) => i.period))].sort();
}

/** Resumen del hogar que se envía a Claude (sin datos personales). */
export function buildFacts(household: Household, services: Service[], invoices: Invoice[], now: Date = new Date()): AssistantFacts {
  const own = invoices.filter((i) => i.householdId === household.id);
  const current = toPeriod(now);
  const periods = periodRange(shiftPeriod(current, -11), current);
  return {
    household: { id: household.id, name: household.name, city: household.city, stratum: household.stratum },
    months: monthsWithData(own).length,
    monthly: periods.map((p) => ({ period: p, amount: sum(own.filter((i) => i.period === p).map((i) => i.amount)) })).filter((m) => m.amount > 0),
    services: services
      .filter((s) => s.householdId === household.id)
      .map((s) => {
        const hist = own.filter((i) => i.serviceId === s.id).sort((a, b) => a.period.localeCompare(b.period));
        const recent = hist.slice(-6);
        return {
          id: s.id,
          type: s.type,
          provider: s.provider,
          avgAmount: recent.length ? Math.round(sum(recent.map((i) => i.amount)) / recent.length) : 0,
          avgConsumption: recent.length ? Math.round((sum(recent.map((i) => i.consumption)) / recent.length) * 10) / 10 : 0,
          lastConsumption: hist.at(-1)?.consumption ?? 0,
        };
      }),
  };
}

// ---------- HU06 Predicción ----------
export function predictions(household: Household, services: Service[], invoices: Invoice[]): ServiceProjection[] {
  const own = invoices.filter((i) => i.householdId === household.id);
  return services.filter((s) => s.householdId === household.id).map((s) => projectNextInvoice(s.id, s.type, own));
}

// ---------- HU07 Perfil ----------
export interface ConsumptionProfile {
  sufficient: boolean;
  monthsUsed: number;
  level: ConsumptionLevel | null;
  averageMonthly: number;
  reference: number;
  ratio: number;
  peakPeriods: string[];
  heaviestService: { type: ServiceType; share: number } | null;
}

export function consumptionProfile(facts: AssistantFacts): ConsumptionProfile {
  const reference = STRATUM_REFERENCE[facts.household.stratum] ?? STRATUM_REFERENCE[3];
  const recent = facts.monthly.slice(-6);
  const base = { monthsUsed: facts.months, reference, peakPeriods: [] as string[], heaviestService: null };
  if (facts.months < MIN_PROJECTION_HISTORY || recent.length === 0) {
    return { ...base, sufficient: false, level: null, averageMonthly: 0, ratio: 0 };
  }
  const averageMonthly = Math.round(sum(recent.map((m) => m.amount)) / recent.length);
  const ratio = Math.round((averageMonthly / reference) * 100) / 100;
  const level: ConsumptionLevel = ratio < 0.85 ? "bajo" : ratio <= 1.15 ? "moderado" : "alto";
  const peakPeriods = [...facts.monthly].sort((a, b) => b.amount - a.amount).slice(0, 2).map((m) => m.period);
  const totalAvg = sum(facts.services.map((s) => s.avgAmount));
  const top = [...facts.services].sort((a, b) => b.avgAmount - a.avgAmount)[0];
  return {
    ...base,
    sufficient: true,
    level,
    averageMonthly,
    ratio,
    peakPeriods,
    heaviestService: top && totalAvg ? { type: top.type, share: Math.round((top.avgAmount / totalAvg) * 100) } : null,
  };
}

// ---------- HU09 Score de sostenibilidad ----------
export interface ScoreBreakdown {
  serviceType: ServiceType;
  weight: number;
  subScore: number;
  consumption: number;
  reference: number;
}

export function serviceSubScore(consumption: number, reference: number): number {
  if (consumption <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((reference / consumption) * 100)));
}

/** Score 0–100 ponderado por servicio; null si no hay servicios medibles. */
export function sustainabilityScore(consumptionByType: Partial<Record<ServiceType, number>>): { value: number; breakdown: ScoreBreakdown[] } | null {
  const breakdown: ScoreBreakdown[] = [];
  for (const [type, weight] of Object.entries(SCORE_WEIGHTS) as [ServiceType, number][]) {
    const consumption = consumptionByType[type];
    const reference = CONSUMPTION_REFERENCE[type]!;
    if (consumption === undefined) continue;
    breakdown.push({ serviceType: type, weight, subScore: serviceSubScore(consumption, reference), consumption, reference });
  }
  if (breakdown.length === 0) return null;
  const totalWeight = sum(breakdown.map((b) => b.weight));
  const value = Math.round(sum(breakdown.map((b) => b.subScore * b.weight)) / totalWeight);
  return { value, breakdown: breakdown.map((b) => ({ ...b, weight: Math.round((b.weight / totalWeight) * 100) / 100 })) };
}

export function scoreRange(value: number): ScoreRange {
  return SCORE_RANGES.find((r) => value >= r.min && value <= r.max)?.key ?? "bajo";
}

/** Score mes a mes (evolución en el tiempo). */
export function scoreHistory(householdId: string, services: Service[], invoices: Invoice[], months = 6, now: Date = new Date()) {
  const typeOf = new Map(services.map((s) => [s.id, s.type]));
  const own = invoices.filter((i) => i.householdId === householdId);
  const current = toPeriod(now);
  return periodRange(shiftPeriod(current, -(months - 1)), current)
    .map((period) => {
      const byType: Partial<Record<ServiceType, number>> = {};
      for (const inv of own.filter((i) => i.period === period)) {
        const t = typeOf.get(inv.serviceId);
        if (t && SCORE_WEIGHTS[t]) byType[t] = (byType[t] ?? 0) + inv.consumption;
      }
      const s = sustainabilityScore(byType);
      return s ? { period, value: s.value } : null;
    })
    .filter((x): x is { period: string; value: number } => x !== null);
}

export function currentScore(facts: AssistantFacts) {
  if (facts.months < MIN_PROJECTION_HISTORY) return null;
  const byType: Partial<Record<ServiceType, number>> = {};
  for (const s of facts.services) if (SCORE_WEIGHTS[s.type]) byType[s.type] = (byType[s.type] ?? 0) + s.avgConsumption;
  return sustainabilityScore(byType);
}

/** Huella que cambia cuando cambian los datos: se usa para recalcular (HU07/HU08). */
export function factsFingerprint(facts: AssistantFacts): string {
  return JSON.stringify([facts.household.id, facts.months, facts.monthly.at(-1), facts.services.map((s) => [s.id, s.avgAmount, s.avgConsumption])]);
}
