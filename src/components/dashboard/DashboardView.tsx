"use client";
// Gabriela · F2 — HU05 dashboard general, HU06 filtros, HU07 comparativa
// histórica y HU08 proyección de gasto. Diseño Figma "Dashboard".
import Link from "next/link";
import { useState } from "react";
import { BellRing, CalendarClock, Layers, LineChart, Receipt, TrendingDown, TrendingUp, X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/hooks/useAuth";
import { useSelectedHousehold, useServices } from "@/hooks/useDomain";
import { useConsumptionFilters, useDashboard } from "@/hooks/useDashboard";
import { PageHeader, StatCard, BarChart, Card } from "@/components/ui/Surface";
import { Badge, EmptyState, InfoNote } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { SelectField, SegmentedControl, TextField } from "@/components/ui/Field";
import { ServiceIcon } from "@/components/common/ServiceIcon";
import { SERVICE_TYPES } from "@/lib/domain/services";
import type { ConsumptionFilters, VariationKind } from "@/lib/domain/dashboard";
import { cx, daysUntil } from "@/lib/utils";

function VariationPill({ label, value, kind }: { label: string; value: number | null; kind: VariationKind }) {
  const { dict, percent } = useI18n();
  const tone = kind === "increase" ? "bg-error-container text-on-error-container" : kind === "saving" ? "bg-secondary-container text-on-secondary-container" : "bg-surface-high text-on-surface-variant";
  const Icon = kind === "saving" ? TrendingDown : TrendingUp;
  return (
    <div className={cx("flex flex-col gap-1 rounded-2xl px-4 py-3", tone)} data-kind={kind}>
      <span className="text-xs font-bold tracking-wider uppercase">{label}</span>
      <span className="flex items-center gap-2 text-xl font-extrabold">
        {value === null ? "—" : percent(value)}
        {kind !== "neutral" && <Icon aria-hidden="true" className="size-5" />}
      </span>
      {kind !== "neutral" && <span className="text-xs font-semibold">{kind === "increase" ? dict.dashboard.history.increase : dict.dashboard.history.saving}</span>}
    </div>
  );
}

function Filters({ ctrl }: { ctrl: ReturnType<typeof useConsumptionFilters> }) {
  const { dict } = useI18n();
  const { filters } = ctrl;
  const [from, setFrom] = useState(filters.from ?? "");
  const [to, setTo] = useState(filters.to ?? "");
  const presets: { value: ConsumptionFilters["preset"]; label: string }[] = [
    { value: "month", label: dict.dashboard.filters.month },
    { value: "quarter", label: dict.dashboard.filters.quarter },
    { value: "year", label: dict.dashboard.filters.year },
    { value: "custom", label: dict.dashboard.filters.custom },
  ];
  const chips = [
    filters.serviceType !== "all" && dict.serviceTypes[filters.serviceType],
    filters.preset !== "month" && presets.find((p) => p.value === filters.preset)?.label,
  ].filter(Boolean) as string[];

  return (
    <section aria-labelledby="dashboard-filters" className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
      <h2 id="dashboard-filters" className="text-lg font-bold">
        {dict.dashboard.filters.title}
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[16rem_minmax(0,1fr)]">
        <SelectField label={dict.dashboard.filters.service} value={filters.serviceType} onChange={(e) => ctrl.setServiceType(e.target.value as ConsumptionFilters["serviceType"])}>
          <option value="all">{dict.dashboard.filters.allServices}</option>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {dict.serviceTypes[s]}
            </option>
          ))}
        </SelectField>
        <SegmentedControl label={dict.dashboard.filters.period} name="preset" value={filters.preset} options={presets} onChange={ctrl.setPreset} />
      </div>
      {filters.preset === "custom" && (
        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <TextField label={dict.dashboard.filters.from} type="month" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label={dict.dashboard.filters.to} type="month" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="h-12 rounded-xl bg-primary px-4 font-semibold text-on-primary disabled:opacity-50" disabled={!from || !to} onClick={() => ctrl.setRange(from, to)}>
            {dict.common.apply}
          </button>
        </div>
      )}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" aria-live="polite">
          <span className="text-sm text-on-surface-variant">{dict.dashboard.filters.applied}</span>
          {chips.map((c) => (
            <Badge key={c} tone="info">
              {c}
            </Badge>
          ))}
          <button type="button" onClick={ctrl.clear} className="flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            <X aria-hidden="true" className="size-4" /> {dict.dashboard.filters.clear}
          </button>
        </div>
      )}
    </section>
  );
}

export function DashboardView() {
  const { dict, href, money, t, period, date } = useI18n();
  const { user } = useAuth();
  const { households, selectedId, setSelectedId } = useSelectedHousehold();
  const services = useServices();
  const ctrl = useConsumptionFilters();
  const data = useDashboard(selectedId, ctrl.filters);
  const [range, setRange] = useState<"6" | "12">("6");
  const firstName = user?.name.split(" ")[0] ?? "";
  const dueThisWeek = data.summary.upcoming.filter((u) => daysUntil(u.invoice.dueDate) <= 7).length;
  const chartSeries = data.history.series.slice(range === "6" ? -6 : -12);
  const serviceOf = (id: string) => services.items.find((s) => s.id === id);

  return (
    <>
      <PageHeader
        title={t(dict.dashboard.greeting, { name: firstName })}
        subtitle={t(dict.dashboard.subtitle, { count: data.summary.upcoming.length })}
        actions={
          households.length > 1 ? (
            <SelectField label={dict.dashboard.household} value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)} className="w-64">
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </SelectField>
          ) : undefined
        }
      />

      <section aria-label={dict.dashboard.kpis} className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label={dict.dashboard.kpi.services} value={data.services.length} caption={dict.common.active} icon={<Layers className="size-5" />} />
        <StatCard label={dict.dashboard.kpi.upcoming} value={dueThisWeek} caption={dict.dashboard.kpi.thisWeek} icon={<Receipt className="size-5" />} badgeTone="danger" />
        <StatCard label={dict.dashboard.kpi.alerts} value={data.activeAlerts} caption={dict.dashboard.kpi.attention} icon={<BellRing className="size-5" />} badgeTone="warning" />
        <StatCard
          label={dict.dashboard.kpi.projection}
          value={money(data.projectedTotal)}
          caption={dict.dashboard.kpi.estimate}
          icon={<LineChart className="size-5" />}
          tone="primary"
          badgeTone="primary"
        />
      </section>

      <Filters ctrl={ctrl} />

      {!data.hasInvoices ? (
        <EmptyState
          icon={<Receipt className="size-8" />}
          title={dict.dashboard.emptyTitle}
          description={dict.dashboard.emptyDescription}
          action={<LinkButton href={href("/facturas/nuevo")}>{dict.invoices.createManual}</LinkButton>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-8">
            <Card aria-labelledby="summary-title" className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="summary-title" className="text-xl font-bold">
                  {dict.dashboard.breakdownTitle}
                </h2>
                <p className="text-sm text-on-surface-variant">
                  {data.periods.length > 0 &&
                    t(dict.dashboard.periodRange, { from: period(data.periods[0], true), to: period(data.periods.at(-1)!, true) })}
                </p>
              </div>
              {data.summary.count === 0 ? (
                <InfoNote>{dict.dashboard.noResults}</InfoNote>
              ) : (
                <>
                  <p className="text-4xl font-extrabold" data-testid="dashboard-total">
                    {money(data.summary.total)}
                  </p>
                  <ul aria-label={dict.dashboard.breakdownTitle} className="flex flex-col gap-3">
                    {data.summary.breakdown.map((b) => (
                      <li key={b.serviceType} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-semibold">
                            <ServiceIcon type={b.serviceType} size="sm" /> {dict.serviceTypes[b.serviceType]}
                          </span>
                          <span className="font-bold">
                            {money(b.amount)} <span className="text-sm font-normal text-on-surface-variant">({b.share}%)</span>
                          </span>
                        </div>
                        <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface-high">
                          <div className="h-full rounded-full bg-primary-container" style={{ width: `${b.share}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card aria-labelledby="history-title" className="flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="history-title" className="text-xl font-bold">
                  {dict.dashboard.history.title}
                </h2>
                <div role="group" aria-label={dict.dashboard.history.range} className="flex gap-1 rounded-lg bg-surface-container p-1">
                  {(["6", "12"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={range === r}
                      onClick={() => setRange(r)}
                      className={cx("rounded-md px-3 py-1 text-sm font-semibold", range === r ? "bg-white shadow" : "text-on-surface-variant")}
                    >
                      {r === "6" ? dict.dashboard.history.sixMonths : dict.dashboard.history.year}
                    </button>
                  ))}
                </div>
              </div>
              <BarChart title={dict.dashboard.history.title} data={chartSeries.map((p) => ({ label: period(p.period, true), value: p.amount }))} formatValue={money} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <VariationPill label={dict.dashboard.history.vsPrevious} value={data.history.vsPrevious} kind={data.history.vsPreviousKind} />
                <VariationPill label={dict.dashboard.history.vsLastYear} value={data.history.vsLastYear} kind={data.history.vsLastYearKind} />
              </div>
              {data.history.limited && <InfoNote>{t(dict.dashboard.history.limited, { months: data.history.monthsAvailable })}</InfoNote>}
            </Card>

            <Card aria-labelledby="projection-title" className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="projection-title" className="text-xl font-bold">
                  {dict.dashboard.projection.title}
                </h2>
                <Badge tone="warning">{dict.dashboard.projection.estimateBadge}</Badge>
              </div>
              <p className="text-sm text-on-surface-variant">{dict.dashboard.projection.disclaimer}</p>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {data.projections.map((p) => (
                  <li key={p.serviceId} className="flex flex-col gap-3 rounded-2xl bg-surface-low p-4" data-testid="projection-card">
                    <span className="flex items-center gap-2 font-bold">
                      <ServiceIcon type={p.serviceType} size="sm" /> {dict.serviceTypes[p.serviceType]}
                    </span>
                    {p.sufficient ? (
                      <>
                        <p className="text-2xl font-extrabold">
                          ≈ {money(p.estimate)}
                        </p>
                        <p className={cx("text-sm font-semibold", p.difference > 0 ? "text-error" : "text-secondary")}>
                          {t(p.difference > 0 ? dict.dashboard.projection.above : dict.dashboard.projection.below, { amount: money(Math.abs(p.difference)) })}
                        </p>
                        <p className="text-xs text-on-surface-variant">{t(dict.dashboard.projection.basedOn, { months: p.monthsUsed })}</p>
                      </>
                    ) : (
                      <p className="text-sm text-on-surface-variant">{t(dict.dashboard.projection.insufficient, { months: p.monthsUsed })}</p>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="flex flex-col gap-8">
            <div className="relative flex flex-col gap-6 overflow-hidden rounded-3xl bg-primary p-8 text-white">
              <span aria-hidden="true" className="absolute -top-10 -right-10 size-48 rounded-full bg-primary-container" />
              <h2 className="relative text-xl font-bold">{dict.dashboard.health.title}</h2>
              <div className="relative mx-auto flex size-40 items-center justify-center">
                <svg aria-hidden="true" viewBox="0 0 160 160" className="absolute inset-0 -rotate-90">
                  <circle cx="80" cy="80" r="70" stroke="#3d6b64" strokeWidth="12" fill="none" />
                  <circle cx="80" cy="80" r="70" stroke="#bbece3" strokeWidth="12" fill="none" strokeLinecap="round" strokeDasharray={`${(data.healthScore / 100) * 440} 440`} />
                </svg>
                <p className="flex flex-col items-center">
                  <span className="text-4xl font-extrabold">{data.healthScore}</span>
                  <span className="text-primary-fixed-dim">/100</span>
                </p>
              </div>
              <p className="relative text-center text-primary-fixed">{dict.dashboard.health.description}</p>
            </div>

            <Card aria-labelledby="upcoming-title" className="flex flex-col gap-4">
              <h2 id="upcoming-title" className="text-xl font-bold">
                {dict.dashboard.upcomingTitle}
              </h2>
              {data.summary.upcoming.length === 0 ? (
                <p className="text-on-surface-variant">{dict.dashboard.noUpcoming}</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {data.summary.upcoming.map(({ invoice, status }) => {
                    const svc = serviceOf(invoice.serviceId);
                    const days = daysUntil(invoice.dueDate);
                    return (
                      <li key={invoice.id} className="flex gap-3">
                        <span className={cx("w-14 shrink-0 pt-3 text-sm font-bold", status === "vencida" ? "text-error" : "text-on-surface-variant")}>
                          {days === 0 ? dict.common.today : date(invoice.dueDate, { day: "2-digit", month: "short" })}
                        </span>
                        <Link
                          href={href(`/facturas/${invoice.id}`)}
                          className={cx(
                            "flex flex-1 flex-col gap-1 rounded-xl border-l-4 p-4",
                            status === "vencida" ? "border-error bg-error-container" : "border-tertiary bg-surface-container",
                          )}
                        >
                          <span className="font-bold">{svc?.provider}</span>
                          <span className="text-sm text-on-surface-variant">{svc && dict.serviceTypes[svc.type]}</span>
                          <span className="flex items-center justify-between gap-2">
                            <span className="font-bold">{money(invoice.amount)}</span>
                            <span className="text-xs font-bold text-error uppercase">
                              {status === "vencida" ? dict.invoiceStatus.vencida : t(dict.invoiceStatus.dueInDays, { days })}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card aria-labelledby="recent-title" className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 id="recent-title" className="text-xl font-bold">
                  {dict.dashboard.recentTitle}
                </h2>
                <Link href={href("/facturas")} className="text-sm font-semibold text-primary hover:underline">
                  {dict.common.viewAll}
                </Link>
              </div>
              <ul className="flex flex-col divide-y divide-surface-high">
                {data.recent.map((inv) => {
                  const svc = serviceOf(inv.serviceId);
                  return (
                    <li key={inv.id} className="flex items-center gap-3 py-3">
                      {svc && <ServiceIcon type={svc.type} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{svc?.provider}</p>
                        <p className="text-sm text-on-surface-variant first-letter:uppercase">{period(inv.period)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">-{money(inv.amount)}</p>
                        <p className="text-xs text-on-surface-variant">{inv.status === "pagada" ? dict.invoiceStatus.pagada : dict.invoiceStatus.pendiente}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <LinkButton href={href("/calendario")} variant="tonal" icon={<CalendarClock aria-hidden="true" className="size-4" />}>
              {dict.dashboard.openCalendar}
            </LinkButton>
          </div>
        </div>
      )}
    </>
  );
}
