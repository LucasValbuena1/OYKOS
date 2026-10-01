"use client";
// Gabriela · F3 — HU09 Listar vehículos · HU13 Detalle y costo · HU12 Eliminar.
// Diseño Figma "vehículos".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Car, Fuel, Pencil, Plus, ShieldCheck, Trash2, Wallet, Wrench, Building2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useSelectedHousehold, useTaxes, useVehicles } from "@/hooks/useDomain";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader, BarChart } from "@/components/ui/Surface";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { EmptyState, InfoNote } from "@/components/ui/Feedback";
import { SelectField, TextField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { formatPlate, vehicleCost } from "@/lib/domain/vehicles";
import { taxDisplayStatus } from "@/lib/domain/taxes";
import { TaxStatusBadge } from "@/components/taxes/TaxStatusBadge";
import { addMonths, toISODate, daysUntil, cx } from "@/lib/utils";
import type { VehicleExpenseCategory } from "@/types";

const CATEGORY_ICON: Record<VehicleExpenseCategory, typeof Fuel> = { combustible: Fuel, mantenimiento: Wrench, seguro: ShieldCheck, otro: Wallet };

export function VehiclesView() {
  const { dict, href, plural, date } = useI18n();
  const vehicles = useVehicles();
  const taxes = useTaxes();
  const { households } = useSelectedHousehold();

  return (
    <>
      <PageHeader
        title={dict.vehicles.title}
        subtitle={dict.vehicles.subtitle}
        actions={
          <LinkButton href={href("/vehiculos/nuevo")} className="rounded-full" size="lg" icon={<Plus aria-hidden="true" className="size-4" />}>
            {dict.vehicles.create}
          </LinkButton>
        }
      />
      <p aria-live="polite" className="text-sm font-bold tracking-widest text-on-surface-variant uppercase">
        {plural(dict.vehicles.counter, vehicles.items.length)}
      </p>
      {vehicles.items.length === 0 ? (
        <EmptyState
          icon={<Car className="size-8" />}
          title={dict.vehicles.emptyTitle}
          description={dict.vehicles.emptyDescription}
          action={<LinkButton href={href("/vehiculos/nuevo")}>{dict.vehicles.createFirst}</LinkButton>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {vehicles.items.map((v) => {
            const nextTax = taxes.items
              .filter((x) => x.assetType === "vehiculo" && x.assetId === v.id && x.status === "pendiente")
              .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
            return (
              <li key={v.id}>
                <Link href={href(`/vehiculos/${v.id}`)} className="relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl bg-surface-container p-6 transition hover:shadow-md">
                  <span aria-hidden="true" className="absolute -top-16 -right-16 size-40 rounded-full bg-primary-fixed/60" />
                  <div aria-hidden="true" className="relative flex h-28 items-center justify-center rounded-xl bg-surface-high">
                    <Car className="size-16 text-primary-container" />
                  </div>
                  <div className="relative flex items-center justify-between gap-2">
                    <span className="rounded-full border border-outline-variant bg-surface px-4 py-1.5 font-mono text-sm font-bold tracking-widest">{formatPlate(v.plate)}</span>
                    <span className="text-sm text-on-surface-variant">{households.find((h) => h.id === v.householdId)?.name}</span>
                  </div>
                  <div className="relative">
                    <h2 className="text-2xl font-bold">
                      {v.brand} {v.model}
                    </h2>
                    <p className="text-on-surface-variant">
                      {dict.vehicleTypes[v.type]} • {v.year}
                    </p>
                  </div>
                  <div className="relative flex items-center justify-between border-t border-outline-variant pt-3">
                    <span className="text-on-surface-variant">{dict.vehicles.nextTax}</span>
                    <span className="font-bold">
                      {nextTax ? (daysUntil(nextTax.dueDate) < 0 ? dict.taxStatus.vencido : date(nextTax.dueDate, { day: "2-digit", month: "short" })) : dict.common.none}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export function VehicleDetail({ id }: { id: string }) {
  const { dict, href, money, date, t, period } = useI18n();
  const vehicles = useVehicles();
  const taxes = useTaxes();
  const { households } = useSelectedHousehold();
  const router = useRouter();
  const { notify } = useToast();
  const vehicle = vehicles.getById(id);
  const [confirming, setConfirming] = useState(false);
  const [from, setFrom] = useState(toISODate(addMonths(new Date(), -12)));
  const [to, setTo] = useState(toISODate(new Date()));
  const [expense, setExpense] = useState({ category: "combustible" as VehicleExpenseCategory, description: "", amount: 0, date: toISODate(new Date()) });

  const cost = useMemo(() => vehicleCost(id, taxes.items, vehicles.expenses.items, from, to), [id, taxes.items, vehicles.expenses.items, from, to]);

  if (!vehicle) return <EmptyState title={dict.vehicles.notFound} action={<LinkButton href={href("/vehiculos")}>{dict.common.back}</LinkButton>} />;

  const name = `${vehicle.brand} ${vehicle.model}`;
  const assocTaxes = taxes.items.filter((x) => x.assetType === "vehiculo" && x.assetId === id);
  const monthly = new Map<string, number>();
  for (const e of cost.expenseItems) monthly.set(e.date.slice(0, 7), (monthly.get(e.date.slice(0, 7)) ?? 0) + e.amount);
  for (const x of cost.taxItems) monthly.set(x.dueDate.slice(0, 7), (monthly.get(x.dueDate.slice(0, 7)) ?? 0) + x.amount);
  const chart = [...monthly.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);

  return (
    <>
      <Link href={href("/vehiculos")} className="inline-flex w-fit items-center gap-2 font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> {dict.vehicles.backToList}
      </Link>
      <Card tone="container" className="flex flex-col gap-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-2xl bg-surface shadow">
              <Car className="size-8 text-primary" />
            </span>
            <div>
              <span className="rounded-full border border-outline-variant bg-surface px-3 py-1 font-mono text-sm font-bold tracking-widest">{formatPlate(vehicle.plate)}</span>
              <h1 className="mt-2 text-3xl font-extrabold md:text-4xl">{name}</h1>
              <p className="text-on-surface-variant">
                {dict.vehicleTypes[vehicle.type]} • {vehicle.year} • {households.find((h) => h.id === vehicle.householdId)?.name}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <IconButton label={t(dict.vehicles.editNamed, { name })} onClick={() => router.push(href(`/vehiculos/${id}/editar`))}>
              <Pencil aria-hidden="true" className="size-4" />
            </IconButton>
            <IconButton label={t(dict.vehicles.deleteNamed, { name })} onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
        </div>
      </Card>

      <section aria-labelledby="period-title" className="flex flex-col gap-4 rounded-3xl bg-white p-6 shadow-sm">
        <h2 id="period-title" className="text-lg font-bold">
          {dict.vehicles.period}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={dict.common.from} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField label={dict.common.to} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-8">
          <Card aria-labelledby="expenses-title" className="flex flex-col gap-4">
            <h2 id="expenses-title" className="text-xl font-bold">
              {t(dict.vehicles.expensesTitle, { name })}
            </h2>
            {cost.expenseItems.length === 0 ? (
              <p className="text-on-surface-variant">{dict.vehicles.noExpenses}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {cost.expenseItems.map((e) => {
                  const Icon = CATEGORY_ICON[e.category];
                  return (
                    <li key={e.id} className="flex items-center justify-between gap-4 rounded-xl bg-surface p-4">
                      <span className="flex items-center gap-4">
                        <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                          <Icon className="size-5" />
                        </span>
                        <span>
                          <span className="block font-bold">{dict.expenseCategories[e.category]}</span>
                          <span className="block text-sm text-on-surface-variant">
                            {e.description} · {date(e.date)}
                          </span>
                        </span>
                      </span>
                      <span className="text-lg font-bold">{money(e.amount)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            <form
              className="mt-2 grid grid-cols-1 items-end gap-3 border-t border-surface-high pt-4 md:grid-cols-[1fr_1.5fr_1fr_1fr_auto]"
              onSubmit={(e) => {
                e.preventDefault();
                if (!expense.amount || expense.amount <= 0 || !expense.date) return;
                vehicles.expenses.add({ ...expense, vehicleId: id, description: expense.description.trim() || dict.expenseCategories[expense.category] });
                setExpense((x) => ({ ...x, description: "", amount: 0 }));
                notify(dict.vehicles.expenseAdded);
              }}
            >
              <SelectField label={dict.vehicles.expense.category} value={expense.category} onChange={(e) => setExpense((x) => ({ ...x, category: e.target.value as VehicleExpenseCategory }))}>
                {(Object.keys(dict.expenseCategories) as VehicleExpenseCategory[]).map((c) => (
                  <option key={c} value={c}>
                    {dict.expenseCategories[c]}
                  </option>
                ))}
              </SelectField>
              <TextField label={dict.vehicles.expense.description} value={expense.description} onChange={(e) => setExpense((x) => ({ ...x, description: e.target.value }))} />
              <TextField label={dict.vehicles.expense.amount} type="number" min={0} value={expense.amount || ""} onChange={(e) => setExpense((x) => ({ ...x, amount: Number(e.target.value) }))} />
              <TextField label={dict.vehicles.expense.date} type="date" value={expense.date} onChange={(e) => setExpense((x) => ({ ...x, date: e.target.value }))} />
              <Button type="submit" variant="tonal">
                {dict.common.add}
              </Button>
            </form>
          </Card>

          <Card aria-labelledby="vehicle-taxes" className="flex flex-col gap-4">
            <h2 id="vehicle-taxes" className="text-xl font-bold">
              {dict.vehicles.taxesTitle}
            </h2>
            {assocTaxes.length === 0 ? (
              <p className="text-on-surface-variant">{dict.vehicles.noTaxes}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {assocTaxes.map((x) => (
                  <li key={x.id}>
                    <Link href={href(`/impuestos/${x.id}`)} className="flex items-center justify-between gap-4 rounded-xl bg-surface p-4 hover:bg-surface-container">
                      <span className="flex items-center gap-3">
                        <Building2 aria-hidden="true" className="size-5 text-primary" />
                        <span className="font-bold">
                          {dict.taxTypes[x.type]} {x.year}
                        </span>
                        <TaxStatusBadge status={taxDisplayStatus(x)} />
                      </span>
                      <span className="font-bold">{money(x.amount)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside aria-labelledby="total-cost" className="relative flex h-fit flex-col gap-8 overflow-hidden rounded-3xl bg-primary p-8 text-white">
          <span aria-hidden="true" className="absolute -top-20 -right-20 size-64 rounded-full bg-[#38665f]" />
          <div className="relative">
            <h2 id="total-cost" className="text-sm font-bold tracking-wider text-primary-fixed uppercase">
              {dict.vehicles.totalCost}
            </h2>
            <p className="mt-2 text-4xl font-extrabold md:text-5xl" data-testid="vehicle-total">
              {money(cost.total)}
            </p>
            <p className="text-primary-fixed-dim">
              {date(from)} – {date(to)}
            </p>
          </div>
          <dl className="relative grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-primary-container p-3">
              <dt className="text-xs text-primary-fixed">{dict.vehicles.taxesPart}</dt>
              <dd className="text-lg font-bold" data-testid="vehicle-taxes-total">
                {money(cost.taxes)}
              </dd>
            </div>
            <div className="rounded-xl bg-primary-container p-3">
              <dt className="text-xs text-primary-fixed">{dict.vehicles.expensesPart}</dt>
              <dd className="text-lg font-bold" data-testid="vehicle-expenses-total">
                {money(cost.expenses)}
              </dd>
            </div>
          </dl>
          {chart.length > 0 ? (
            <div className="relative">
              <BarChart title={dict.vehicles.totalCost} data={chart.map(([p, v]) => ({ label: period(p, true), value: v }))} formatValue={money} height={150} dark />
            </div>
          ) : (
            <p className={cx("relative text-primary-fixed")}>{dict.vehicles.noCosts}</p>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t(dict.vehicles.confirmDeleteTitle, { name })}
        message={dict.vehicles.confirmDeleteMessage}
        confirmLabel={dict.common.delete}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          vehicles.removeVehicle(id);
          setConfirming(false);
          notify(t(dict.vehicles.deleted, { name }));
          router.push(href("/vehiculos"));
        }}
      >
        <InfoNote tone="warning">{t(dict.vehicles.cascade, { taxes: assocTaxes.length, expenses: vehicles.expenses.items.filter((e) => e.vehicleId === id).length })}</InfoNote>
      </ConfirmDialog>
    </>
  );
}
