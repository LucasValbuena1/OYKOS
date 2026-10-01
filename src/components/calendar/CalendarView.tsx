"use client";
// Calendario de vencimientos (pantalla del Figma "calendario"): reúne
// facturas e impuestos por fecha límite con estados pagado/pendiente/vencido.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useInvoices, useServices, useTaxes } from "@/hooks/useDomain";
import { useAssetName } from "@/hooks/useTaxDetail";
import { PageHeader } from "@/components/ui/Surface";
import { IconButton } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { buildCalendarEvents, monthMatrix, type CalendarEvent } from "@/lib/domain/calendar";
import { cx, intlDay, toISODate } from "@/lib/utils";
import { intlLocale } from "@/i18n/config";

const DOT: Record<CalendarEvent["state"], string> = { paid: "bg-paid", pending: "bg-pending", overdue: "bg-error" };

export function CalendarView() {
  const { dict, locale, money, href } = useI18n();
  const invoices = useInvoices();
  const services = useServices();
  const taxes = useTaxes();
  const assetName = useAssetName();
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(toISODate(today));

  const events = useMemo(
    () =>
      buildCalendarEvents(invoices.items, taxes.items, (id) => {
        const s = services.getById(id);
        return s ? `${s.provider} · ${dict.serviceTypes[s.type]}` : "—";
      }, (t) => `${dict.taxTypes[t.type]} · ${assetName(t.assetType, t.assetId)}`),
    [invoices.items, taxes.items, services, dict, assetName],
  );
  const weeks = monthMatrix(cursor);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);
  const dayEvents = byDay.get(selected) ?? [];
  const monthLabel = new Intl.DateTimeFormat(intlLocale[locale], { month: "long", year: "numeric" }).format(cursor);
  const weekdays = Array.from({ length: 7 }, (_, i) => intlDay(i, intlLocale[locale]));

  return (
    <>
      <PageHeader
        title={dict.calendar.title}
        subtitle={dict.calendar.subtitle}
        actions={
          <div className="flex items-center gap-2 rounded-full bg-surface-container p-1">
            <IconButton label={dict.calendar.prev} variant="ghost" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}>
              <ChevronLeft aria-hidden="true" className="size-5" />
            </IconButton>
            <p className="min-w-40 text-center text-lg font-bold first-letter:uppercase" aria-live="polite">
              {monthLabel}
            </p>
            <IconButton label={dict.calendar.next} variant="ghost" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}>
              <ChevronRight aria-hidden="true" className="size-5" />
            </IconButton>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <section aria-label={dict.calendar.grid} className="flex flex-col gap-6 rounded-3xl bg-white p-4 shadow-sm md:p-6">
          <ul className="flex flex-wrap gap-6 text-sm font-semibold tracking-wide text-on-surface-variant uppercase">
            {(["paid", "pending", "overdue"] as const).map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span aria-hidden="true" className={cx("size-3 rounded-full", DOT[s])} /> {dict.calendar.legend[s]}
              </li>
            ))}
          </ul>
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">{monthLabel}</caption>
            <thead>
              <tr>
                {weekdays.map((d) => (
                  <th key={d} scope="col" className="py-2 text-xs font-semibold text-on-surface-variant uppercase sm:text-sm">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, wi) => (
                <tr key={wi}>
                  {week.map((day) => {
                    const iso = toISODate(day);
                    const inMonth = day.getMonth() === cursor.getMonth();
                    const list = byDay.get(iso) ?? [];
                    const isSelected = iso === selected;
                    const isToday = iso === toISODate(today);
                    return (
                      <td key={iso} className={cx("h-16 border border-outline-variant/60 p-0 align-top sm:h-24", !inMonth && "bg-surface-low")}>
                        <button
                          type="button"
                          onClick={() => setSelected(iso)}
                          aria-pressed={isSelected}
                          aria-label={`${new Intl.DateTimeFormat(intlLocale[locale], { dateStyle: "full" }).format(day)}${list.length ? `, ${list.length} ${dict.calendar.events}` : ""}`}
                          className={cx("flex h-full w-full flex-col gap-1 p-1.5 text-left sm:p-2", isSelected && "rounded-lg ring-2 ring-primary")}
                        >
                          <span className={cx("text-sm font-semibold", isToday && "flex size-7 items-center justify-center rounded-full bg-primary text-white", !inMonth && "text-on-surface-variant/60")}>
                            {day.getDate()}
                          </span>
                          <span className="flex flex-col gap-1">
                            {list.slice(0, 3).map((e) => (
                              <span key={e.id} aria-hidden="true" className={cx("h-1.5 w-full rounded-full", DOT[e.state])} />
                            ))}
                          </span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <aside aria-labelledby="day-title" className="flex flex-col gap-4 overflow-hidden rounded-3xl bg-white shadow-sm">
          <div className="flex items-center justify-between bg-surface-high px-6 py-5">
            <div>
              <h2 id="day-title" className="text-2xl font-bold first-letter:uppercase">
                {new Intl.DateTimeFormat(intlLocale[locale], { weekday: "long", day: "numeric" }).format(new Date(`${selected}T00:00`))}
              </h2>
              <p className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">
                {new Intl.DateTimeFormat(intlLocale[locale], { month: "long", year: "numeric" }).format(new Date(`${selected}T00:00`))}
              </p>
            </div>
            <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-primary text-white">
              <CalendarDays className="size-5" />
            </span>
          </div>
          <div className="flex flex-col gap-4 px-6 pb-6" aria-live="polite">
            {dayEvents.length === 0 ? (
              <p className="text-on-surface-variant">{dict.calendar.noEvents}</p>
            ) : (
              dayEvents.map((e) => (
                <div
                  key={e.id}
                  className={cx(
                    "flex flex-col gap-3 rounded-xl p-5",
                    e.state === "overdue" ? "bg-error-container" : e.state === "paid" ? "bg-secondary-container/50" : "bg-surface",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{e.title}</p>
                    <Badge tone={e.state === "overdue" ? "danger" : e.state === "paid" ? "success" : "warning"}>{dict.calendar.legend[e.state]}</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className={cx("text-2xl font-extrabold", e.state === "overdue" && "text-error")}>{money(e.amount)}</p>
                    {e.state !== "paid" && (
                      <Link
                        href={href(e.href)}
                        className={cx("rounded-lg px-4 py-2 font-semibold text-white", e.state === "overdue" ? "bg-error" : "bg-primary")}
                      >
                        {e.state === "overdue" ? dict.calendar.payUrgent : dict.calendar.payNow}
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
