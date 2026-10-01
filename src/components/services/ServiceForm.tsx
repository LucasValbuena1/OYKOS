"use client";
// Lucas · F1 — HU02 Registrar servicio / HU03 Editar servicio.
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useId } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useSelectedHousehold, useServices } from "@/hooks/useDomain";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { SelectField, TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState, InfoNote } from "@/components/ui/Feedback";
import { emptyService, PROVIDERS, SERVICE_TYPES, validateService, type ServiceInput } from "@/lib/domain/services";
import type { Service } from "@/types";

function Form({ initial, editing }: { initial: ServiceInput; editing?: Service }) {
  const { dict, href, t } = useI18n();
  const services = useServices();
  const { households } = useSelectedHousehold();
  const router = useRouter();
  const { notify } = useToast();
  const providersId = useId();
  const validate = useCallback((v: ServiceInput) => validateService(v, services.items, editing?.id), [services.items, editing?.id]);

  const form = useForm<ServiceInput>({
    initialValues: initial,
    validate,
    onSubmit: (values) => {
      const clean = { ...values, provider: values.provider.trim(), accountNumber: values.accountNumber.trim() };
      const name = `${dict.serviceTypes[clean.type]} · ${clean.provider}`;
      if (editing) {
        // Solo campos editables: no se toca el tipo ni las facturas existentes
        services.update(editing.id, { provider: clean.provider, accountNumber: clean.accountNumber, cutoffDay: clean.cutoffDay });
        notify(t(dict.services.updated, { name }));
        router.push(href(`/servicios/${editing.id}`));
      } else {
        services.add({ ...clean, createdAt: new Date().toISOString() });
        notify(t(dict.services.created, { name }));
        router.push(href("/servicios"));
      }
    },
  });

  return (
    <Card className="max-w-3xl">
      <form noValidate onSubmit={form.handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <SelectField label={dict.services.fields.type} required disabled={!!editing} hint={editing ? dict.services.typeLocked : undefined} {...form.field("type")}>
          {SERVICE_TYPES.map((s) => (
            <option key={s} value={s}>
              {dict.serviceTypes[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label={dict.services.fields.household} required disabled={!!editing} {...form.field("householdId")}>
          <option value="">{dict.common.select}</option>
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </SelectField>
        <div className="md:col-span-2">
          <TextField label={dict.services.fields.provider} required list={providersId} autoComplete="off" hint={dict.services.providerHint} {...form.field("provider")} />
          <datalist id={providersId}>
            {PROVIDERS[form.values.type].map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </div>
        <TextField label={dict.services.fields.accountNumber} required inputMode="numeric" {...form.field("accountNumber")} />
        <TextField label={dict.services.fields.cutoffDay} required type="number" min={1} max={31} {...form.field("cutoffDay")} />
        {editing && <InfoNote>{dict.services.editNote}</InfoNote>}
        <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
          <Button variant="tonal" onClick={() => router.push(editing ? href(`/servicios/${editing.id}`) : href("/servicios"))}>
            {dict.common.cancel}
          </Button>
          <Button type="submit">{editing ? dict.common.saveChanges : dict.services.create}</Button>
        </div>
      </form>
    </Card>
  );
}

export function ServiceForm({ id }: { id?: string }) {
  const { dict } = useI18n();
  const services = useServices();
  const params = useSearchParams();
  const { selectedId } = useSelectedHousehold();
  const editing = id ? services.getById(id) : undefined;

  return (
    <>
      <PageHeader title={id ? dict.services.editTitle : dict.services.createTitle} subtitle={dict.services.formSubtitle} />
      {id && !editing ? (
        <EmptyState title={dict.services.notFound} />
      ) : (
        <Form
          key={editing?.id ?? "new"}
          editing={editing}
          initial={
            editing
              ? { householdId: editing.householdId, type: editing.type, provider: editing.provider, accountNumber: editing.accountNumber, cutoffDay: editing.cutoffDay }
              : emptyService(params.get("hogar") ?? selectedId ?? "")
          }
        />
      )}
    </>
  );
}
