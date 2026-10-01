"use client";
// Gabriela · F1 — HU01 Listar facturas (filtros por hogar/servicio/estado y
// resaltado de próximas a vencer / vencidas). Diseño Figma "facturas".
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Filter, Lightbulb, PenLine, ScanLine, Receipt, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useInvoices, useSelectedHousehold, useServices } from "@/hooks/useDomain";
import { PageHeader, ProgressBar, BarChart } from "@/components/ui/Surface";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { SelectField } from "@/components/ui/Field";
import { ServiceIcon } from "@/components/common/ServiceIcon";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { useInvoiceFilters } from "@/hooks/useInvoiceFilters";
import {
  filterInvoices,
  invoiceDisplayStatus,
  invoiceTotals,
  needsAttention,
  type InvoiceFilters,
} from "@/lib/domain/invoices";
import { SERVICE_TYPES } from "@/lib/domain/services";
import { monthlySeries } from "@/lib/domain/dashboard";
import { cx, daysUntil, toPeriod } from "@/lib/utils";

const PAGE_SIZE = 10;

export function InvoicesView() {
  const { dict, href, money, date, period, plural, t } = useI18n();
  const invoices = useInvoices();
  const services = useServices();
  const { households } = useSelectedHousehold();
  const { filters, setStatus, setHousehold, toggleServiceType, clear } = useInvoiceFilters();

  const [visible, setVisible] = useState(PAGE_SIZE);
  const list = useMemo(() => filterInvoices(invoices.items, services.items, filters), [invoices.items, services.items, filters]);
  const currentMonth = invoices.items.filter((i) => i.period === toPeriod(new Date()) && (filters.householdId === "all" || i.householdId === filters.householdId));
  const totals = invoiceTotals(currentMonth);
  const trend = monthlySeries(filters.householdId === "all" ? invoices.items : invoices.items.filter((i) => i.householdId === filters.householdId), 6);
  const serviceById = new Map(services.items.map((s) => [s.id, s]));

  const statusOptions: { value: InvoiceFilters["status"]; label: string; tone: string }[] = [
    { value: "all", label: dict.invoices.filters.all, tone: "bg-surface-container text-on-surface" },
    { value: "pendiente", label: dict.invoiceStatus.pendiente, tone: "bg-surface-container text-on-surface" },
    { value: "pagada", label: dict.invoiceStatus.pagada, tone: "bg-surface-container text-on-surface" },
    { value: "vencida", label: dict.invoiceStatus.vencida, tone: "bg-error-container text-error" },
  ];

  return (
    <>
      <PageHeader
        title={dict.invoices.title}
        subtitle={dict.invoices.subtitle}
        actions={
          <>
            <LinkButton href={href("/facturas/escanear")} variant="secondary" size="lg" icon={<ScanLine aria-hidden="true" className="size-5" />} className="uppercase">
              {dict.invoices.scanAi}
            </LinkButton>
            <LinkButton href={href("/facturas/nuevo")} variant="outline" size="lg" icon={<PenLine aria-hidden="true" className="size-5" />} className="uppercase">
              {dict.invoices.manual}
            </LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside aria-label={dict.invoices.filters.title} className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm">
          <section aria-labelledby="month-summary" className="flex flex-col gap-4 border-b border-surface-high pb-6">
            <h2 id="month-summary" className="text-xl font-bold">
              {dict.invoices.summary.title}
            </h2>
            <div>
              <p className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.invoices.summary.total}</p>
              <p className="text-3xl font-extrabold">{money(totals.total)}</p>
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.invoices.summary.paid}</p>
              <p className="text-2xl font-bold text-secondary">{money(totals.paid)}</p>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-sm font-semibold">
                <span className="tracking-wider text-on-surface-variant uppercase">{dict.invoices.summary.progress}</span>
                <span>{totals.progress}%</span>
              </div>
              <ProgressBar value={totals.progress} label={dict.invoices.summary.progress} />
            </div>
          </section>

          <section aria-labelledby="filters-title" className="flex flex-col gap-5">
            <div className="flex items-center justify-between">
              <h2 id="filters-title" className="flex items-center gap-2 text-xl font-bold">
                <Filter aria-hidden="true" className="size-5" /> {dict.invoices.filters.title}
              </h2>
              <button type="button" onClick={clear} className="text-sm font-semibold text-primary hover:underline">
                {dict.common.clear}
              </button>
            </div>
            <SelectField label={dict.invoices.filters.household} value={filters.householdId} onChange={(e) => setHousehold(e.target.value)}>
              <option value="all">{dict.invoices.filters.allHouseholds}</option>
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </SelectField>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.invoices.filters.service}</legend>
              {SERVICE_TYPES.map((type) => (
                <label key={type} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={filters.serviceTypes.includes(type)}
                    onChange={() => toggleServiceType(type)}
                    className="size-5 rounded accent-primary-container"
                  />
                  {dict.serviceTypes[type]}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.invoices.filters.status}</legend>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={filters.status === opt.value}
                    onClick={() => setStatus(opt.value)}
                    className={cx(
                      "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                      filters.status === opt.value ? "bg-primary-container text-white" : opt.tone,
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          <div className="rounded-2xl border border-primary-container/40 bg-primary-fixed/20 p-4">
            <p className="flex items-center gap-2 text-sm font-bold tracking-wider text-primary-container uppercase">
              <Lightbulb aria-hidden="true" className="size-4" /> {dict.invoices.tipTitle}
            </p>
            <p className="mt-2 text-sm text-on-surface-variant">{dict.invoices.tip}</p>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="invoice-list" className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-high p-6">
              <div className="flex items-center gap-3">
                <h2 id="invoice-list" className="text-2xl font-bold">
                  {dict.invoices.listTitle}
                </h2>
                <span aria-live="polite" className="rounded-full bg-surface-container px-3 py-0.5 text-sm text-on-surface-variant">
                  {plural(dict.invoices.count, list.length)}
                </span>
              </div>
            </div>
            {list.length === 0 ? (
              <div className="p-6">
                <EmptyState icon={<Receipt className="size-8" />} title={dict.invoices.emptyTitle} description={dict.invoices.emptyDescription} action={<LinkButton href={href("/facturas/nuevo")}>{dict.invoices.createManual}</LinkButton>} />
              </div>
            ) : (
              <>
              <ul>
                {list.slice(0, visible).map((inv) => {
                  const svc = serviceById.get(inv.serviceId);
                  const status = invoiceDisplayStatus(inv);
                  const days = daysUntil(inv.dueDate);
                  const attention = needsAttention(status);
                  return (
                    <li key={inv.id} className={cx("border-b border-surface-high last:border-0", attention && "bg-error-container/30")} data-attention={attention || undefined}>
                      <Link href={href(`/facturas/${inv.id}`)} className="flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-surface-low sm:flex-nowrap">
                        <div className="flex min-w-0 items-center gap-4">
                          {svc && <ServiceIcon type={svc.type} />}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-lg font-bold">
                                {svc ? `${svc.provider} - ${dict.serviceTypes[svc.type]}` : dict.invoices.unknownService}
                              </h3>
                              <InvoiceStatusBadge status={status} daysLeft={status === "por_vencer" ? days : undefined} />
                            </div>
                            <p className="text-sm text-on-surface-variant first-letter:uppercase">
                              {t(dict.invoices.periodRef, { period: period(inv.period), ref: svc?.accountNumber ?? "-" })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className={cx("text-xl font-bold", status === "pagada" && "text-on-surface-variant")}>{money(inv.amount)}</p>
                            <p className={cx("text-xs font-semibold uppercase", attention ? "text-error" : "text-on-surface-variant")}>
                              {status === "pagada" && inv.paidAt
                                ? t(dict.invoices.paidOn, { date: date(inv.paidAt, { day: "2-digit", month: "short" }) })
                                : t(dict.invoices.dueOn, { date: date(inv.dueDate, { day: "2-digit", month: "short" }) })}
                            </p>
                          </div>
                          <span aria-hidden="true" className={cx("flex size-10 items-center justify-center rounded-full", attention ? "bg-primary-container text-white" : "bg-surface-container")}>
                            <ChevronRight className="size-5" />
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {list.length > visible && (
                <div className="flex justify-center border-t border-surface-high p-4">
                  <button type="button" onClick={() => setVisible((v) => v + PAGE_SIZE)} className="rounded-xl px-4 py-2 font-semibold text-primary hover:bg-surface-low">
                    {t(dict.invoices.showMore, { count: Math.min(PAGE_SIZE, list.length - visible) })}
                  </button>
                </div>
              )}
              </>
            )}
          </section>

          <section aria-labelledby="trend-title" className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 id="trend-title" className="text-xl font-bold">
                  {dict.invoices.trendTitle}
                </h2>
                <p className="text-sm text-on-surface-variant">{dict.invoices.trendSubtitle}</p>
              </div>
              <p className="flex items-center gap-2 text-sm font-semibold text-primary-container">
                <TrendingUp aria-hidden="true" className="size-4" /> {dict.invoices.trendNote}
              </p>
            </div>
            <BarChart
              title={dict.invoices.trendTitle}
              data={trend.map((p) => ({ label: period(p.period, true), value: p.amount }))}
              formatValue={(v) => money(v)}
              height={180}
            />
            <Link href={href("/reportes")} className="flex items-center gap-2 text-sm font-bold tracking-wider text-primary-container uppercase hover:underline">
              {dict.invoices.detailedReport} <ChevronRight aria-hidden="true" className="size-4" />
            </Link>
          </section>
        </div>
      </div>
    </>
  );
}
