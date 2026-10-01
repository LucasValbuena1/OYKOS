"use client";
// Alejandro · F1 — HU05 Recibir notificación: centro de notificaciones con
// distintivo de no leídas, marcar como leídas y navegar al servicio.
// Incluye los avisos de vencimiento de facturas (Alejandro · F3 HU17).
import Link from "next/link";
import { BellOff, CheckCheck, ArrowLeft, AlertTriangle } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useNotifications, useSelectedHousehold, useServices } from "@/hooks/useDomain";
import { PageHeader } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Feedback";
import { SERVICE_UNITS } from "@/lib/domain/services";
import { DueRemindersSection } from "@/components/ai/DueReminders";
import { cx } from "@/lib/utils";

export function NotificationsCenter() {
  const { dict, href, t, money, number, period, dateTime } = useI18n();
  const { items, unread, markRead, markAllRead } = useNotifications();
  const services = useServices();
  const { households } = useSelectedHousehold();

  return (
    <>
      <Link href={href("/alertas")} className="inline-flex w-fit items-center gap-2 font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> {dict.alerts.backToList}
      </Link>
      <PageHeader
        title={dict.notifications.title}
        subtitle={t(dict.notifications.unreadCount, { count: unread })}
        actions={
          unread > 0 ? (
            <Button variant="tonal" icon={<CheckCheck aria-hidden="true" className="size-4" />} onClick={markAllRead}>
              {dict.notifications.markAll}
            </Button>
          ) : undefined
        }
      />
      <DueRemindersSection />
      <h2 className="text-xl font-bold">{dict.notifications.alertsTitle}</h2>
      {items.length === 0 ? (
        <EmptyState icon={<BellOff className="size-8" />} title={dict.notifications.emptyTitle} description={dict.notifications.emptyDescription} />
      ) : (
        <ul className="flex flex-col gap-4" aria-live="polite">
          {items.map((n) => {
            const svc = services.getById(n.serviceId);
            const fmt = (v: number) => (n.thresholdType === "valor" ? money(v) : `${number(v, 1)} ${svc ? SERVICE_UNITS[svc.type] : ""}`);
            const name = svc ? `${dict.serviceTypes[svc.type]} · ${svc.provider}` : dict.notifications.deletedService;
            return (
              <li
                key={n.id}
                className={cx("flex flex-wrap items-start justify-between gap-4 rounded-2xl p-5", n.read ? "bg-white" : "bg-tertiary-fixed/60 ring-1 ring-tertiary/30")}
                data-read={n.read}
              >
                <div className="flex min-w-0 items-start gap-4">
                  <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container">
                    <AlertTriangle className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-bold">
                      {t(dict.notifications.alertTitle, { name })}
                      {!n.read && <Badge tone="danger">{dict.notifications.new}</Badge>}
                    </p>
                    <p className="text-on-surface-variant">
                      {t(dict.notifications.message, {
                        household: households.find((h) => h.id === n.householdId)?.name ?? "—",
                        value: fmt(n.value),
                        threshold: fmt(n.threshold),
                        period: period(n.period),
                      })}
                    </p>
                    <p className="mt-1 text-xs text-on-surface-variant">{dateTime(n.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {svc && (
                    <Link href={href(`/servicios/${svc.id}`)} onClick={() => markRead(n.id)} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                      {dict.notifications.viewService}
                    </Link>
                  )}
                  {!n.read && (
                    <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                      {dict.notifications.markRead}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
