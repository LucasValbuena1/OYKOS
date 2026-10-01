"use client";
// Felipe · F3 — HU10 Crear impuesto (advertencia de duplicado) · HU11 Editar
// impuesto (advertencia si ya está pagado).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useHouseholds, useTaxes, useVehicles } from "@/hooks/useDomain";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { SegmentedControl, SelectField, TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState, InfoNote } from "@/components/ui/Feedback";
import { ConfirmDialog } from "@/components/ui/Modal";
import { emptyTax, findDuplicateTax, TAX_TYPES, validateTax, type TaxInput } from "@/lib/domain/taxes";
import type { Tax } from "@/types";

function Form({ initial, editing }: { initial: TaxInput; editing?: Tax }) {
  const { dict, href, money, t } = useI18n();
  const taxes = useTaxes();
  const households = useHouseholds();
  const vehicles = useVehicles();
  const router = useRouter();
  const { notify } = useToast();
  const [duplicateOf, setDuplicateOf] = useState<TaxInput | null>(null);

  const save = (values: TaxInput) => {
    if (editing) {
      const changes: Partial<Tax> = { ...values };
      // Si cambia el valor y había plan de cuotas, se recalcula proporcionalmente
      if (editing.paymentMode === "cuotas" && values.amount !== editing.amount) {
        const ratio = values.amount / editing.amount;
        changes.installments = editing.installments.map((c) => ({ ...c, amount: Math.round(c.amount * ratio) }));
      }
      taxes.update(editing.id, changes);
      notify(dict.taxes.updated);
      router.push(href(`/impuestos/${editing.id}`));
    } else {
      taxes.add({ ...values, status: "pendiente", paymentMode: "contado", installments: [], createdAt: new Date().toISOString() });
      notify(dict.taxes.created);
      router.push(href("/impuestos"));
    }
  };

  const form = useForm<TaxInput>({
    initialValues: initial,
    validate: validateTax,
    onSubmit: (values) => {
      if (findDuplicateTax(values, taxes.items, editing?.id)) {
        setDuplicateOf(values);
        return;
      }
      save(values);
    },
  });

  const assets =
    form.values.assetType === "hogar"
      ? households.items.map((h) => ({ id: h.id, label: h.name }))
      : vehicles.items.map((v) => ({ id: v.id, label: `${v.brand} ${v.model} (${v.plate})` }));

  return (
    <Card className="max-w-3xl">
      {editing?.status === "pagado" && (
        <div className="mb-6">
          <InfoNote tone="warning">{dict.taxes.paidEditWarning}</InfoNote>
        </div>
      )}
      <form noValidate onSubmit={form.handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SelectField label={dict.taxes.fields.type} required {...form.field("type")}>
          {TAX_TYPES.map((x) => (
            <option key={x} value={x}>
              {dict.taxTypes[x]}
            </option>
          ))}
        </SelectField>
        <SegmentedControl
          label={dict.taxes.fields.assetType}
          name="assetType"
          value={form.values.assetType}
          onChange={(v) => form.setValues((prev) => ({ ...prev, assetType: v, assetId: "" }))}
          options={[
            { value: "hogar", label: dict.taxes.assetTypes.hogar },
            { value: "vehiculo", label: dict.taxes.assetTypes.vehiculo },
          ]}
        />
        <SelectField label={dict.taxes.fields.asset} required className="md:col-span-2" {...form.field("assetId")}>
          <option value="">{dict.common.select}</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </SelectField>
        <TextField label={dict.taxes.fields.year} type="number" required min={2000} {...form.field("year")} />
        <TextField
          label={dict.taxes.fields.amount}
          type="number"
          required
          min={0}
          step="1000"
          prefix="$"
          hint={form.values.amount > 0 ? money(Number(form.values.amount)) : undefined}
          {...form.field("amount")}
        />
        <TextField label={dict.taxes.fields.dueDate} type="date" required {...form.field("dueDate")} />
        <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
          <Button variant="tonal" onClick={() => router.push(editing ? href(`/impuestos/${editing.id}`) : href("/impuestos"))}>
            {dict.common.cancel}
          </Button>
          <Button type="submit">{editing ? dict.common.saveChanges : dict.taxes.create}</Button>
        </div>
      </form>
      <ConfirmDialog
        open={!!duplicateOf}
        tone="primary"
        title={dict.taxes.duplicateTitle}
        message={duplicateOf ? t(dict.taxes.duplicateMessage, { type: dict.taxTypes[duplicateOf.type], year: duplicateOf.year }) : ""}
        confirmLabel={dict.taxes.saveAnyway}
        onCancel={() => setDuplicateOf(null)}
        onConfirm={() => {
          if (duplicateOf) save(duplicateOf);
          setDuplicateOf(null);
        }}
      />
    </Card>
  );
}

export function TaxForm({ id }: { id?: string }) {
  const { dict } = useI18n();
  const taxes = useTaxes();
  const editing = id ? taxes.getById(id) : undefined;
  return (
    <>
      <PageHeader title={id ? dict.taxes.editTitle : dict.taxes.createTitle} subtitle={dict.taxes.formSubtitle} />
      {id && !editing ? (
        <EmptyState title={dict.taxes.notFound} />
      ) : (
        <Form
          key={editing?.id ?? "new"}
          editing={editing}
          initial={
            editing
              ? { type: editing.type, assetType: editing.assetType, assetId: editing.assetId, year: editing.year, amount: editing.amount, dueDate: editing.dueDate }
              : emptyTax()
          }
        />
      )}
    </>
  );
}
