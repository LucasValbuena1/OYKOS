"use client";
// Lucas · F1 — HU01 Listar servicios · HU04 Eliminar servicio (desde el detalle).
// Sin pantalla propia en Figma: reutiliza el estilo de "Servicios Conectados" de Hogares.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus, Trash2, Zap, ArrowLeft } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useInvoices, useSelectedHousehold, useServices } from "@/hooks/useDomain";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { IconButton, LinkButton } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Feedback";
import { ConfirmDialog } from "@/components/ui/Modal";
import { SelectField } from "@/components/ui/Field";
import { ServiceIcon } from "@/components/common/ServiceIcon";
import { lastInvoice, servicesByHousehold, SERVICE_UNITS } from "@/lib/domain/services";
import { invoiceDisplayStatus } from "@/lib/domain/invoices";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";

export function ServicesView() {
  const { dict, href, money, plural } = useI18n();
  const { households, selectedId, setSelectedId } = useSelectedHousehold();
  const services = useServices();
  const invoices = useInvoices();
  const list = servicesByHousehold(selectedId, services.items);

  return (
    <>
      <PageHeader
        title={dict.services.title}
        subtitle={dict.services.subtitle}
        actions={
          <LinkButton href={`${href("/servicios/nuevo")}${selectedId ? `?hogar=${selectedId}` : ""}`} size="lg" icon={<Plus aria-hidden="true" className="size-4" />}>
            {dict.services.create}
          </LinkButton>
        }
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        {households.length > 1 && (
          <SelectField label={dict.services.householdFilter} value={selectedId ?? ""} onChange={(e) => setSelectedId(e.target.value)} className="w-full sm:w-72">
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </SelectField>
        )}
        <p aria-live="polite" className="text-sm font-bold tracking-widest text-on-surface-variant uppercase">
          {plural(dict.services.counter, list.length)}
        </p>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={<Zap className="size-8" />}
          title={dict.services.emptyTitle}
          description={dict.services.emptyDescription}
          action={<LinkButton href={`${href("/servicios/nuevo")}${selectedId ? `?hogar=${selectedId}` : ""}`}>{dict.services.createFirst}</LinkButton>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const last = lastInvoice(s.id, invoices.items);
            return (
              <li key={s.id}>
                <Link
                  href={href(`/servicios/${s.id}`)}
                  className="relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <span aria-hidden="true" className="absolute -top-8 -right-8 size-24 rounded-full bg-primary-fixed/50" />
                  <div className="relative flex items-center justify-between gap-2">
                    <ServiceIcon type={s.type} />
                    <span className="truncate rounded-md bg-surface-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">{s.provider}</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{dict.serviceTypes[s.type]}</h2>
                    <p className="text-on-surface-variant">
                      {dict.services.contract} {s.accountNumber}
                    </p>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-outline-variant pt-3 text-sm">
                    <span className="text-on-surface-variant">{dict.services.lastInvoice}</span>
                    <span className="font-bold">{last ? money(last.amount) : dict.services.noInvoices}</span>
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

export function ServiceDetail({ id }: { id: string }) {
  const { dict, href, money, period, date, t, number } = useI18n();
  const services = useServices();
  const invoices = useInvoices();
  const { households } = useSelectedHousehold();
  const router = useRouter();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);
  const service = services.getById(id);

  if (!service) return <EmptyState title={dict.services.notFound} action={<LinkButton href={href("/servicios")}>{dict.common.back}</LinkButton>} />;

  const household = households.find((h) => h.id === service.householdId);
  const history = invoices.items.filter((i) => i.serviceId === id).sort((a, b) => b.period.localeCompare(a.period));
  const name = `${dict.serviceTypes[service.type]} · ${service.provider}`;

  return (
    <>
      <Link href={href("/servicios")} className="inline-flex w-fit items-center gap-2 font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> {dict.services.backToList}
      </Link>
      <Card tone="low" className="flex flex-col gap-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <ServiceIcon type={service.type} size="lg" />
            <div>
              <p className="text-sm font-bold tracking-widest text-primary uppercase">{household?.name}</p>
              <h1 className="text-3xl font-extrabold md:text-4xl">{dict.serviceTypes[service.type]}</h1>
              <p className="text-on-surface-variant">{service.provider}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <IconButton label={t(dict.services.editNamed, { name })} onClick={() => router.push(href(`/servicios/${id}/editar`))}>
              <Pencil aria-hidden="true" className="size-4" />
            </IconButton>
            <IconButton label={t(dict.services.deleteNamed, { name })} onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4">
            <dt className="text-sm text-on-surface-variant">{dict.services.fields.accountNumber}</dt>
            <dd className="text-lg font-bold">{service.accountNumber}</dd>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <dt className="text-sm text-on-surface-variant">{dict.services.fields.cutoffDay}</dt>
            <dd className="text-lg font-bold">{service.cutoffDay}</dd>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <dt className="text-sm text-on-surface-variant">{dict.services.invoiceCount}</dt>
            <dd className="text-lg font-bold">{history.length}</dd>
          </div>
        </dl>
      </Card>

      <section aria-labelledby="service-history" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="service-history" className="text-2xl font-bold">
            {dict.services.history}
          </h2>
          <LinkButton href={`${href("/facturas/nuevo")}?servicio=${id}`} variant="tonal" icon={<Plus aria-hidden="true" className="size-4" />}>
            {dict.invoices.createManual}
          </LinkButton>
        </div>
        {history.length === 0 ? (
          <p className="text-on-surface-variant">{dict.services.noInvoices}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full min-w-[560px] text-left">
              <caption className="sr-only">{dict.services.history}</caption>
              <thead className="bg-surface-low text-xs tracking-wider text-on-surface-variant uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">{dict.invoices.fields.period}</th>
                  <th scope="col" className="px-4 py-3">{dict.invoices.fields.consumption}</th>
                  <th scope="col" className="px-4 py-3">{dict.invoices.fields.amount}</th>
                  <th scope="col" className="px-4 py-3">{dict.invoices.fields.dueDate}</th>
                  <th scope="col" className="px-4 py-3">{dict.invoices.fields.status}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((inv) => (
                  <tr key={inv.id} className="border-t border-surface-high">
                    <td className="px-4 py-3 first-letter:uppercase">
                      <Link href={href(`/facturas/${inv.id}`)} className="font-semibold text-primary hover:underline">
                        {period(inv.period)}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {number(inv.consumption, 1)} {SERVICE_UNITS[service.type]}
                    </td>
                    <td className="px-4 py-3 font-bold">{money(inv.amount)}</td>
                    <td className="px-4 py-3">{date(inv.dueDate)}</td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoiceDisplayStatus(inv)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirming}
        title={t(dict.services.confirmDeleteTitle, { name })}
        message={dict.services.confirmDeleteMessage}
        confirmLabel={dict.common.delete}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          services.removeService(id);
          setConfirming(false);
          notify(t(dict.services.deleted, { name }));
          router.push(href("/servicios"));
        }}
      >
        <Badge tone="danger">{t(dict.services.cascadeCount, { count: history.length })}</Badge>
      </ConfirmDialog>
    </>
  );
}
