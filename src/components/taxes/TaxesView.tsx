"use client";
// Felipe · F3 — HU09 Listar impuestos (filtros por estado y bien, vencidos
// resaltados, distintivo de pronto pago). Diseño Figma "impuestos".
import Link from "next/link";
import { useMemo, useState } from "react";
import { Building2, CalendarClock, Car, ChevronDown, ChevronRight, Info, Landmark, Plus } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useTaxes } from "@/hooks/useDomain";
import { useAssetName } from "@/hooks/useTaxDetail";
import { PageHeader, BarChart } from "@/components/ui/Surface";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, Badge } from "@/components/ui/Feedback";
import { SelectField } from "@/components/ui/Field";
import { TaxStatusBadge, EarlyPaymentBadge } from "./TaxStatusBadge";
import { discountedAmount, filterTaxes, isDiscountActive, payableAmount, projectTax, taxDisplayStatus, taxHistory, type TaxFilters } from "@/lib/domain/taxes";
import { cx, daysUntil, sum } from "@/lib/utils";
import type { Tax } from "@/types";

function TaxCard({ tax, all }: { tax: Tax; all: Tax[] }) {
  const { dict, href, money, t, plural } = useI18n();
  const assetName = useAssetName();
  const [open, setOpen] = useState(false);
  const status = taxDisplayStatus(tax);
  const days = daysUntil(tax.dueDate);
  const discount = isDiscountActive(tax);
  const history = taxHistory(tax, all);
  const projection = projectTax(history);
  const Icon = tax.assetType === "vehiculo" ? Car : tax.type === "valorizacion" ? Landmark : Building2;
  const panelId = `tax-panel-${tax.id}`;

  return (
    <li
      className={cx(
        "relative overflow-hidden rounded-3xl shadow-sm",
        status === "vencido" ? "bg-error-container/40 ring-2 ring-error" : open ? "bg-white" : "bg-surface-container",
      )}
      data-status={status}
    >
      <span aria-hidden="true" className={cx("absolute inset-y-0 left-0 w-2", status === "vencido" ? "bg-error" : status === "pagado" ? "bg-secondary" : "bg-primary")} />
      <div className="flex flex-wrap items-center justify-between gap-4 p-6 pl-8">
        <Link href={href(`/impuestos/${tax.id}`)} className="flex min-w-0 items-center gap-4 hover:underline">
          <span aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-surface-high">
            <Icon className="size-6 text-primary" />
          </span>
          <span className="min-w-0">
            <span className="block text-xl font-bold">
              {dict.taxTypes[tax.type]} - {assetName(tax.assetType, tax.assetId)}
            </span>
            <span className="block text-on-surface-variant">{t(dict.taxes.yearLabel, { year: tax.year })}</span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-col items-end gap-1">
            <span className="text-xl font-bold">{money(tax.amount)}</span>
            <div className="flex flex-wrap justify-end gap-1">
              <TaxStatusBadge status={status} />
              {discount && <EarlyPaymentBadge />}
              {status === "pendiente" && days >= 0 && <Badge tone={days <= 15 ? "danger" : "neutral"}>{plural(dict.taxes.dueIn, days)}</Badge>}
            </div>
          </div>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => setOpen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-full hover:bg-surface-high"
            aria-label={open ? dict.common.collapse : dict.common.expand}
          >
            <ChevronDown aria-hidden="true" className={cx("size-5 transition-transform", open && "rotate-180")} />
          </button>
        </div>
      </div>
      {open && (
        <div id={panelId} className="grid grid-cols-1 gap-8 px-8 pb-8 md:grid-cols-2">
          <div className="rounded-2xl bg-surface-low p-5">
            <p className="mb-4 text-sm font-bold tracking-wider text-secondary uppercase">{dict.taxes.history.title}</p>
            {history.length >= 2 ? (
              <BarChart
                title={dict.taxes.history.title}
                height={150}
                data={[
                  ...history.map((h) => ({ label: String(h.year), value: h.amount })),
                  ...(projection.sufficient ? [{ label: `${projection.nextYear}*`, value: projection.estimate, dashed: true }] : []),
                ]}
                formatValue={(v) => money(v)}
                highlightLast={false}
              />
            ) : (
              <p className="text-sm text-on-surface-variant">{dict.taxes.history.insufficient}</p>
            )}
          </div>
          <div className="flex flex-col gap-3">
            {tax.discount && (
              <div className="flex items-center justify-between rounded-xl bg-surface-container px-5 py-4">
                <span className="font-semibold text-on-surface-variant">{dict.taxes.discount.title}</span>
                <span className={cx("text-xl font-bold", discount ? "text-secondary" : "text-on-surface-variant line-through")}>
                  -{money(tax.amount - discountedAmount(tax.amount, tax.discount.percent))}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl bg-surface-container px-5 py-4">
              <span className="font-semibold text-on-surface-variant">{dict.taxes.finalValue}</span>
              <span className="text-xl font-bold text-primary">{money(payableAmount(tax))}</span>
            </div>
            <LinkButton href={href(`/impuestos/${tax.id}`)} size="lg" className="mt-auto rounded-2xl" icon={<ChevronRight aria-hidden="true" className="size-4" />}>
              {dict.taxes.manage}
            </LinkButton>
          </div>
        </div>
      )}
    </li>
  );
}

export function TaxesView() {
  const { dict, href, money, date, t, percent } = useI18n();
  const taxes = useTaxes();
  const assetName = useAssetName();
  const [filters, setFilters] = useState<TaxFilters>({ status: "all", assetType: "all" });
  const list = useMemo(() => filterTaxes(taxes.items, filters), [taxes.items, filters]);
  const year = new Date().getFullYear();
  const yearTotal = sum(taxes.items.filter((x) => x.year === year).map((x) => x.amount));
  const prevTotal = sum(taxes.items.filter((x) => x.year === year - 1).map((x) => x.amount));
  const next = taxes.items
    .filter((x) => x.status === "pendiente" && daysUntil(x.dueDate) >= 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  return (
    <>
      <PageHeader
        eyebrow={dict.taxes.eyebrow}
        title={dict.taxes.title}
        subtitle={dict.taxes.subtitle}
        actions={
          <LinkButton href={href("/impuestos/nuevo")} size="lg" icon={<Plus aria-hidden="true" className="size-4" />}>
            {dict.taxes.create}
          </LinkButton>
        }
      />

      <section aria-label={dict.taxes.summary} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-primary p-8 text-white">
          <span aria-hidden="true" className="absolute -top-8 -right-8 size-32 rounded-full bg-primary-container" />
          <p className="relative flex items-center justify-between text-sm font-bold tracking-wider text-primary-fixed uppercase">
            {t(dict.taxes.totalYear, { year })} <Info aria-hidden="true" className="size-4" />
          </p>
          <p className="relative mt-6 text-4xl font-extrabold md:text-5xl">{money(yearTotal)}</p>
          {prevTotal > 0 && (
            <p className="relative mt-2 text-primary-fixed-dim">
              {t(dict.taxes.vsPrevious, { value: percent(((yearTotal - prevTotal) / prevTotal) * 100) })}
            </p>
          )}
        </div>
        <div className="rounded-3xl bg-surface-container p-8">
          <p className="flex items-center justify-between text-sm font-bold tracking-wider text-secondary uppercase">
            {dict.taxes.nextDue} <CalendarClock aria-hidden="true" className="size-4" />
          </p>
          {next ? (
            <>
              <p className="mt-6 text-3xl font-extrabold">{date(next.dueDate)}</p>
              <p className="mt-2 text-lg text-on-surface-variant">
                {dict.taxTypes[next.type]} · {assetName(next.assetType, next.assetId)}
              </p>
            </>
          ) : (
            <p className="mt-6 text-on-surface-variant">{dict.taxes.noneDue}</p>
          )}
        </div>
      </section>

      <section aria-labelledby="tax-list" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="tax-list" className="text-2xl font-bold">
            {dict.taxes.currentCycle}
          </h2>
          <div className="flex flex-wrap gap-4">
            <SelectField label={dict.taxes.filters.status} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as TaxFilters["status"] }))} className="w-44">
              <option value="all">{dict.common.all}</option>
              <option value="pendiente">{dict.taxStatus.pendiente}</option>
              <option value="pagado">{dict.taxStatus.pagado}</option>
              <option value="vencido">{dict.taxStatus.vencido}</option>
            </SelectField>
            <SelectField label={dict.taxes.filters.asset} value={filters.assetType} onChange={(e) => setFilters((f) => ({ ...f, assetType: e.target.value as TaxFilters["assetType"] }))} className="w-44">
              <option value="all">{dict.common.all}</option>
              <option value="hogar">{dict.taxes.assetTypes.hogar}</option>
              <option value="vehiculo">{dict.taxes.assetTypes.vehiculo}</option>
            </SelectField>
          </div>
        </div>
        <p aria-live="polite" className="sr-only">
          {t(dict.taxes.resultCount, { count: list.length })}
        </p>
        {taxes.items.length === 0 ? (
          <EmptyState icon={<Building2 className="size-8" />} title={dict.taxes.emptyTitle} description={dict.taxes.emptyDescription} action={<LinkButton href={href("/impuestos/nuevo")}>{dict.taxes.createFirst}</LinkButton>} />
        ) : list.length === 0 ? (
          <p className="text-on-surface-variant">{dict.taxes.noResults}</p>
        ) : (
          <ul className="flex flex-col gap-6">
            {list.map((tax) => (
              <TaxCard key={tax.id} tax={tax} all={taxes.items} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
