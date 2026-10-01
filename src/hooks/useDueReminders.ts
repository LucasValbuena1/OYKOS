"use client";
// useDueReminders — Alejandro · F3 HU17: avisos antes de la fecha límite.
import { useCallback, useMemo } from "react";
import type { ReminderSettings } from "@/types";
import { dueRemindersStore, invoicesStore, reminderSettingsStore } from "@/data/stores";
import { useStore } from "./useStore";
import { dueReminders, pruneReminders } from "@/lib/domain/reminders";

export function useDueReminders() {
  const [reminders, setReminders] = useStore(dueRemindersStore);
  const [settings, setSettings] = useStore(reminderSettingsStore);
  const [invoices] = useStore(invoicesStore);

  /** Genera los avisos nuevos y limpia los de facturas pagadas o eliminadas. */
  const evaluate = useCallback((now: Date = new Date()) => {
    const current = pruneReminders(dueRemindersStore.get(), invoicesStore.get());
    const created = dueReminders(invoicesStore.get(), reminderSettingsStore.get(), current, now);
    if (created.length || current.length !== dueRemindersStore.get().length) dueRemindersStore.set([...current, ...created]);
    return created;
  }, []);

  const visible = useMemo(() => {
    const pending = new Set(invoices.filter((i) => i.status !== "pagada").map((i) => i.id));
    return [...reminders].filter((r) => pending.has(r.invoiceId)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [reminders, invoices]);

  const updateSettings = useCallback(
    (next: ReminderSettings) => {
      setSettings(next);
      // Si se desactivan, se descartan los avisos pendientes
      if (!next.enabled) setReminders([]);
    },
    [setSettings, setReminders],
  );

  return {
    reminders: visible,
    unread: visible.filter((r) => !r.read).length,
    settings,
    updateSettings,
    evaluate,
    markRead: (id: string) => setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, read: true } : r))),
    markAllRead: () => setReminders((prev) => prev.map((r) => ({ ...r, read: true }))),
  };
}
