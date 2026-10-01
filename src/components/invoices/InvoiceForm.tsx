"use client";
// Gabriela · F1 — HU02 Registrar factura (manual o foto/PDF) · HU03 Editar factura.
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useInvoices, useServices, useSelectedHousehold } from "@/hooks/useDomain";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { SegmentedControl, SelectField, TextField } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { Button } from "@/components/ui/Button";
import { EmptyState, InfoNote } from "@/components/ui/Feedback";
import { emptyInvoice, validateInvoice, type InvoiceInput } from "@/lib/domain/invoices";
import { SERVICE_UNITS } from "@/lib/domain/services";
import { lookupPaymentLink } from "@/lib/paymentLinkClient";
import type { Invoice } from "@/types";

function Form({ initial, editing }: { initial: InvoiceInput; editing?: Invoice }) {
  const { dict, href } = useI18n();
  const invoices = useInvoices();
  const services = useServices();
  const { households } = useSelectedHousehold();
  const router = useRouter();
  const { notify } = useToast();
  const [mode, setMode] = useState<"manual" | "foto">(initial.source === "manual" ? "manual" : "foto");
  const [attachmentError, setAttachmentError] = useState(false);

  const form = useForm<InvoiceInput>({
    initialValues: initial,
    validate: validateInvoice,
    onSubmit: (values) => {
      if (mode === "foto" && !values.attachment) {
        setAttachmentError(true);
        return;
      }
      const svc = services.getById(values.serviceId);
      const data = { ...values, householdId: svc?.householdId ?? values.householdId, source: editing ? editing.source : mode };
      if (editing) {
        invoices.update(editing.id, data);
        notify(dict.invoices.updated);
        router.push(href(`/facturas/${editing.id}`));
      } else {
        const created = invoices.add({
          ...data,
          reference: values.reference?.trim() || undefined,
          status: "pendiente",
          createdAt: new Date().toISOString(),
        });
        // HU14 (Alejandro): con referencia, se busca el link de pago en segundo plano
        if (svc && values.reference?.trim()) {
          void lookupPaymentLink(svc.provider, values.reference).then(({ link }) => {
            if (link) invoices.update(created.id, { paymentLink: link });
          });
        }
        notify(dict.invoices.created);
        router.push(href("/facturas"));
      }
    },
  });

  const selectedService = services.getById(form.values.serviceId);
  const householdName = (id: string) => households.find((h) => h.id === id)?.name ?? "";

  return (
    <Card className="max-w-3xl">
      <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-6">
        {!editing && (
          <SegmentedControl
            label={dict.invoices.form.mode}
            name="mode"
            value={mode}
            onChange={setMode}
            options={[
              { value: "manual", label: dict.invoices.form.manual },
              { value: "foto", label: dict.invoices.form.photo },
            ]}
          />
        )}
        {mode === "foto" && (
          <div className="flex flex-col gap-2">
            <FileField
              label={dict.invoices.form.receipt}
              value={form.values.attachment}
              onChange={(file) => {
                form.setField("attachment", file);
                setAttachmentError(false);
              }}
            />
            {attachmentError && (
              <p role="alert" className="text-sm font-semibold text-error">
                {dict.invoices.form.receiptRequired}
              </p>
            )}
            <InfoNote>{dict.invoices.form.photoNote}</InfoNote>
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SelectField label={dict.invoices.fields.service} required className="md:col-span-2" {...form.field("serviceId")}>
            <option value="">{dict.common.select}</option>
            {services.items.map((s) => (
              <option key={s.id} value={s.id}>
                {dict.serviceTypes[s.type]} · {s.provider} ({householdName(s.householdId)})
              </option>
            ))}
          </SelectField>
          <TextField label={dict.invoices.fields.period} type="month" required {...form.field("period")} />
          <TextField label={dict.invoices.fields.dueDate} type="date" required {...form.field("dueDate")} />
          <TextField
            label={`${dict.invoices.fields.consumption}${selectedService ? ` (${SERVICE_UNITS[selectedService.type]})` : ""}`}
            type="number"
            min={0}
            step="0.1"
            required
            {...form.field("consumption")}
          />
          <TextField label={dict.invoices.fields.amount} type="number" min={0} step="100" prefix="$" required {...form.field("amount")} />
          <TextField label={dict.invoices.fields.reference} hint={dict.invoices.form.referenceHint} className="md:col-span-2" {...form.field("reference")} />
        </div>
        {mode === "manual" && (
          <FileField label={dict.invoices.form.support} value={form.values.attachment} onChange={(file) => form.setField("attachment", file)} />
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="tonal" onClick={() => router.push(editing ? href(`/facturas/${editing.id}`) : href("/facturas"))}>
            {dict.common.cancel}
          </Button>
          <Button type="submit">{editing ? dict.common.saveChanges : dict.invoices.save}</Button>
        </div>
      </form>
    </Card>
  );
}

export function InvoiceForm({ id }: { id?: string }) {
  const { dict } = useI18n();
  const invoices = useInvoices();
  const services = useServices();
  const params = useSearchParams();
  const editing = id ? invoices.getById(id) : undefined;
  const presetService = services.getById(params.get("servicio"));

  return (
    <>
      <PageHeader title={id ? dict.invoices.editTitle : dict.invoices.createTitle} subtitle={dict.invoices.formSubtitle} />
      {id && !editing ? (
        <EmptyState title={dict.invoices.notFound} />
      ) : (
        <Form
          key={editing?.id ?? "new"}
          editing={editing}
          initial={
            editing
              ? {
                  serviceId: editing.serviceId,
                  householdId: editing.householdId,
                  period: editing.period,
                  consumption: editing.consumption,
                  amount: editing.amount,
                  dueDate: editing.dueDate,
                  source: editing.source,
                  attachment: editing.attachment,
                  reference: editing.reference ?? "",
                }
              : emptyInvoice(presetService?.id ?? "", presetService?.householdId ?? "")
          }
        />
      )}
    </>
  );
}
