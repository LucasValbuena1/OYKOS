"use client";
// Gabriela · F1 — detalle de factura: soporte, HU03 editar, HU04 eliminar.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useInvoices, useServices, useSelectedHousehold } from "@/hooks/useDomain";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Surface";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { ConfirmDialog } from "@/components/ui/Modal";
import { ServiceIcon } from "@/components/common/ServiceIcon";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";
import { invoiceDisplayStatus } from "@/lib/domain/invoices";
import { InvoicePaymentPanel } from "@/components/ai/InvoicePaymentPanel";
import { SERVICE_UNITS } from "@/lib/domain/services";
import { daysUntil, toISODate } from "@/lib/utils";

export function InvoiceDetail({ id }: { id: string }) {
  const { dict, href, money, date, period, number, t } = useI18n();
  const invoices = useInvoices();
  const services = useServices();
  const { households } = useSelectedHousehold();
  const router = useRouter();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);
  const invoice = invoices.getById(id);

  if (!invoice) return <EmptyState title={dict.invoices.notFound} action={<LinkButton href={href("/facturas")}>{dict.common.back}</LinkButton>} />;

  const svc = services.getById(invoice.serviceId);
  const household = households.find((h) => h.id === invoice.householdId);
  const status = invoiceDisplayStatus(invoice);

  return (
    <>
      <Link href={href("/facturas")} className="inline-flex w-fit items-center gap-2 font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> {dict.invoices.backToList}
      </Link>
      <Card className="flex max-w-3xl flex-col gap-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {svc && <ServiceIcon type={svc.type} size="lg" />}
            <div>
              <p className="text-sm font-bold tracking-widest text-primary uppercase">{household?.name}</p>
              <h1 className="text-3xl font-extrabold">{svc ? `${svc.provider} - ${dict.serviceTypes[svc.type]}` : dict.invoices.unknownService}</h1>
              <p className="text-on-surface-variant first-letter:uppercase">{period(invoice.period)}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <IconButton label={dict.invoices.edit} onClick={() => router.push(href(`/facturas/${id}/editar`))}>
              <Pencil aria-hidden="true" className="size-4" />
            </IconButton>
            <IconButton label={dict.invoices.delete} onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
        </div>
        <InvoiceStatusBadge status={status} daysLeft={status === "por_vencer" ? daysUntil(invoice.dueDate) : undefined} />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-surface-low p-4">
            <dt className="text-sm text-on-surface-variant">{dict.invoices.fields.amount}</dt>
            <dd className="text-2xl font-extrabold">{money(invoice.amount)}</dd>
          </div>
          <div className="rounded-2xl bg-surface-low p-4">
            <dt className="text-sm text-on-surface-variant">{dict.invoices.fields.consumption}</dt>
            <dd className="text-2xl font-extrabold">
              {number(invoice.consumption, 1)} {svc ? SERVICE_UNITS[svc.type] : ""}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface-low p-4">
            <dt className="text-sm text-on-surface-variant">{dict.invoices.fields.dueDate}</dt>
            <dd className="text-2xl font-extrabold">{date(invoice.dueDate)}</dd>
          </div>
        </dl>
        <section aria-labelledby="support-title" className="flex flex-col gap-2">
          <h2 id="support-title" className="text-lg font-bold">
            {dict.invoices.form.support}
          </h2>
          {invoice.attachment ? (
            <a href={invoice.attachment.dataUrl} download={invoice.attachment.name} className="inline-flex items-center gap-2 font-semibold text-primary underline">
              <Paperclip aria-hidden="true" className="size-4" /> {invoice.attachment.name}
            </a>
          ) : (
            <p className="text-on-surface-variant">{dict.invoices.noSupport}</p>
          )}
        </section>
        {invoice.status === "pendiente" && (
          <Button
            className="w-fit"
            icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
            onClick={() => {
              invoices.markPaid(id, toISODate(new Date()));
              notify(dict.invoices.markedPaid);
            }}
          >
            {dict.invoices.markPaid}
          </Button>
        )}
      </Card>
      <InvoicePaymentPanel invoice={invoice} />
      <ConfirmDialog
        open={confirming}
        title={dict.invoices.confirmDeleteTitle}
        message={dict.invoices.confirmDeleteMessage}
        confirmLabel={dict.common.delete}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          invoices.remove(id);
          setConfirming(false);
          notify(t(dict.invoices.deleted, { period: period(invoice.period) }));
          router.push(href("/facturas"));
        }}
      />
    </>
  );
}
