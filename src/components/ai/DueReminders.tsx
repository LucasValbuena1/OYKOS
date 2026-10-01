"use client";
// Alejandro · F3 — HU17 Recibir aviso de vencimiento: avisos N días antes de la
// fecha límite (configurable), con acceso directo a la factura para pagarla.
import Link from "next/link";
import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useDueReminders } from "@/hooks/useDueReminders";
import { useInvoices, useServices } from "@/hooks/useDomain";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { Switch, TextField } from "@/components/ui/Field";
import { validateReminderDays } from "@/lib/domain/reminders";
import { cx, daysUntil } from "@/lib/utils";

/** "5, 1" → [5, 1] (sin repetidos). */
export function parseReminderDays(raw: string): number[] {
  const parts = raw.split(/[,\s]+/).filter(Boolean);
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n))) return [];
  return [...new Set(nums)].sort((a, b) => b - a);
}

function ReminderSettingsForm() {
  const { dict } = useI18n();
  const { settings, updateSettings } = useDueReminders();
  const { notify } = useToast();
  const [days, setDays] = useState(settings.daysBefore.join(", "));
  const [error, setError] = useState<string | undefined>();
  const r = dict.reminders;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-bold">{r.enable}</p>
          <p className="text-sm text-on-surface-variant">{r.enableDescription}</p>
        </div>
        <Switch
          label={r.enable}
          checked={settings.enabled}
          onChange={(enabled) => {
            updateSettings({ ...settings, enabled });
            notify(enabled ? r.enabled : r.disabled);
          }}
        />
      </div>
      <form
        noValidate
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = parseReminderDays(days);
          if (!validateReminderDays(parsed)) return setError(r.daysError);
          setError(undefined);
          updateSettings({ ...settings, daysBefore: parsed });
          notify(r.saved);
        }}
      >
        <TextField
          label={r.days}
          hint={r.daysHint}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          errorText={error}
          disabled={!settings.enabled}
          className="min-w-56 flex-1"
        />
        <Button type="submit" variant="tonal" disabled={!settings.enabled}>
          {dict.common.save}
        </Button>
      </form>
    </div>
  );
}

export function DueRemindersSection() {
  const { dict, href, t, money, date, plural } = useI18n();
  const { reminders, markRead, settings } = useDueReminders();
  const invoices = useInvoices();
  const services = useServices();
  const r = dict.reminders;

  return (
    <Card aria-labelledby="reminders-title" className="flex flex-col gap-5">
      <h2 id="reminders-title" className="flex items-center gap-2 text-xl font-bold">
        <CalendarClock aria-hidden="true" className="size-5 text-primary" /> {r.title}
      </h2>
      <ReminderSettingsForm />
      {settings.enabled &&
        (reminders.length === 0 ? (
          <p className="text-on-surface-variant">{r.empty}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-live="polite">
            {reminders.map((rem) => {
              const inv = invoices.getById(rem.invoiceId);
              const svc = inv ? services.getById(inv.serviceId) : undefined;
              const left = daysUntil(rem.dueDate);
              const when = left <= 0 ? r.today : plural(r.inDays, left);
              return (
                <li
                  key={rem.id}
                  data-testid="due-reminder"
                  data-read={rem.read}
                  className={cx("flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4", rem.read ? "bg-surface-low" : "bg-primary-fixed/60 ring-1 ring-primary/30")}
                >
                  <div>
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {t(r.message, { service: svc ? `${dict.serviceTypes[svc.type]} · ${svc.provider}` : "—", when })}
                      {!rem.read && <Badge tone="danger">{dict.notifications.new}</Badge>}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      {t(r.detail, { amount: money(inv?.amount ?? 0), date: date(rem.dueDate) })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={href(`/facturas/${rem.invoiceId}`)}
                      onClick={() => markRead(rem.id)}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
                    >
                      {inv?.paymentLink ? r.pay : r.view}
                    </Link>
                    {!rem.read && (
                      <Button size="sm" variant="ghost" onClick={() => markRead(rem.id)}>
                        {dict.notifications.markRead}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ))}
    </Card>
  );
}
