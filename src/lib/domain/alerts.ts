// Reglas de alertas por consumo (Alejandro · Funcionalidad 1).
import type { AlertRule, AppNotification, Invoice } from "@/types";
import { sum, toPeriod, uid } from "@/lib/utils";
import { isBlank, isPositiveNumber, type FormErrors } from "@/lib/validation";

export type AlertRuleInput = Omit<AlertRule, "id" | "createdAt" | "active">;

export const emptyRule = (householdId = ""): AlertRuleInput => ({
  householdId,
  serviceId: "",
  thresholdType: "valor",
  threshold: 0,
  channel: "app",
});

export function validateRule(input: AlertRuleInput): FormErrors<AlertRuleInput> {
  const errors: FormErrors<AlertRuleInput> = {};
  if (isBlank(input.householdId)) errors.householdId = "required";
  if (isBlank(input.serviceId)) errors.serviceId = "required";
  if (isBlank(input.threshold as unknown as string) || !input.threshold) errors.threshold = "required";
  else if (!isPositiveNumber(input.threshold)) errors.threshold = "positive";
  return errors;
}

/** Valor alcanzado por la regla en un periodo (suma de facturas del servicio). */
export function ruleValue(rule: AlertRule, invoices: Invoice[], period: string): number {
  const items = invoices.filter((i) => i.serviceId === rule.serviceId && i.period === period);
  return sum(items.map((i) => (rule.thresholdType === "valor" ? i.amount : i.consumption)));
}

export type RuleState = "exceeded" | "near" | "stable" | "inactive";

export function ruleProgress(rule: AlertRule, invoices: Invoice[], now: Date = new Date()) {
  const value = ruleValue(rule, invoices, toPeriod(now));
  const ratio = rule.threshold ? value / rule.threshold : 0;
  let state: RuleState = "stable";
  if (!rule.active) state = "inactive";
  else if (ratio > 1) state = "exceeded";
  else if (ratio >= 0.85) state = "near";
  return { value, ratio: Math.min(ratio, 1), percent: Math.round(ratio * 100), state };
}

/**
 * Evalúa las reglas activas y devuelve SOLO las notificaciones nuevas.
 * No se notifica más de una vez por la misma regla y periodo (HU05).
 */
export function evaluateRules(
  rules: AlertRule[],
  invoices: Invoice[],
  existing: AppNotification[],
  now: Date = new Date(),
): AppNotification[] {
  const created: AppNotification[] = [];
  const periods = [...new Set(invoices.map((i) => i.period))];
  for (const rule of rules) {
    if (!rule.active) continue;
    // La regla aplica desde el mes en que se creó (no se notifica historia vieja)
    const since = toPeriod(new Date(rule.createdAt));
    for (const period of periods) {
      if (period < since) continue;
      const value = ruleValue(rule, invoices, period);
      if (value <= rule.threshold) continue;
      const already =
        existing.some((n) => n.ruleId === rule.id && n.period === period) ||
        created.some((n) => n.ruleId === rule.id && n.period === period);
      if (already) continue;
      created.push({
        id: uid("ntf"),
        ruleId: rule.id,
        serviceId: rule.serviceId,
        householdId: rule.householdId,
        period,
        thresholdType: rule.thresholdType,
        threshold: rule.threshold,
        value,
        read: false,
        createdAt: now.toISOString(),
      });
    }
  }
  return created;
}

export const unreadCount = (notifications: AppNotification[]) => notifications.filter((n) => !n.read).length;
