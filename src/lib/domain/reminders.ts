// HU17 · Avisos de vencimiento antes de la fecha límite (p. ej. 5 y 1 día antes).
import type { DueReminder, Invoice, ReminderSettings } from "@/types";
import { daysUntil, uid } from "@/lib/utils";

export const defaultReminderSettings: ReminderSettings = { enabled: true, daysBefore: [5, 1] };

export function validateReminderDays(days: number[]): boolean {
  return days.length > 0 && days.every((d) => Number.isInteger(d) && d >= 0 && d <= 30);
}

/**
 * Crea solo los avisos nuevos: facturas pendientes cuya fecha límite está a
 * N días o menos (N configurado). No avisa facturas pagadas ni repite avisos.
 */
export function dueReminders(
  invoices: Invoice[],
  settings: ReminderSettings,
  existing: DueReminder[],
  now: Date = new Date(),
): DueReminder[] {
  if (!settings.enabled) return [];
  const out: DueReminder[] = [];
  const thresholds = [...settings.daysBefore].sort((a, b) => a - b);
  for (const inv of invoices) {
    if (inv.status === "pagada") continue;
    const left = daysUntil(inv.dueDate, now);
    if (left < 0) continue;
    // El umbral más cercano que ya se alcanzó (ej. faltan 3 días → aviso de 5)
    const threshold = thresholds.find((t) => left <= t);
    if (threshold === undefined) continue;
    const dup = [...existing, ...out].some((r) => r.invoiceId === inv.id && r.daysBefore === threshold);
    if (dup) continue;
    out.push({ id: uid("due"), invoiceId: inv.id, daysBefore: threshold, dueDate: inv.dueDate, read: false, createdAt: now.toISOString() });
  }
  return out;
}

/** Quita avisos de facturas que ya se pagaron o se eliminaron. */
export function pruneReminders(reminders: DueReminder[], invoices: Invoice[]): DueReminder[] {
  const pending = new Set(invoices.filter((i) => i.status !== "pagada").map((i) => i.id));
  return reminders.filter((r) => pending.has(r.invoiceId));
}
