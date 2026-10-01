"use client";
// Lucas · F2 — HU06 Reportar falla (evidencia, radicado, fecha no futura).
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useIncidents, useServices, useSelectedHousehold } from "@/hooks/useDomain";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { LinkButton } from "@/components/ui/Button";
import { emptyIncident, INCIDENT_TYPES, validateIncident, type IncidentInput } from "@/lib/domain/incidents";
import type { Attachment } from "@/types";

function nowLocalInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function IncidentForm() {
  const { dict, href, t } = useI18n();
  const incidents = useIncidents();
  const services = useServices();
  const { households } = useSelectedHousehold();
  const router = useRouter();
  const { notify } = useToast();
  const [evidence, setEvidence] = useState<Attachment | undefined>();

  const form = useForm<IncidentInput>({
    initialValues: emptyIncident(),
    validate: (v) => validateIncident(v),
    onSubmit: (values) => {
      const created = incidents.report({ ...values, evidence });
      notify(t(dict.incidents.created, { code: created.code }));
      router.push(href(`/incidentes/${created.id}`));
    },
  });

  if (services.items.length === 0) {
    return (
      <>
        <PageHeader title={dict.incidents.createTitle} />
        <EmptyState title={dict.incidents.needService} action={<LinkButton href={href("/servicios/nuevo")}>{dict.services.create}</LinkButton>} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={dict.incidents.createTitle} subtitle={dict.incidents.createSubtitle} />
      <Card className="max-w-3xl">
        <form noValidate onSubmit={form.handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <SelectField label={dict.incidents.fields.service} required className="md:col-span-2" {...form.field("serviceId")}>
            <option value="">{dict.common.select}</option>
            {services.items.map((s) => (
              <option key={s.id} value={s.id}>
                {dict.serviceTypes[s.type]} · {s.provider} ({households.find((h) => h.id === s.householdId)?.name})
              </option>
            ))}
          </SelectField>
          <SelectField label={dict.incidents.fields.type} required {...form.field("type")}>
            {INCIDENT_TYPES.map((x) => (
              <option key={x} value={x}>
                {dict.incidentTypes[x]}
              </option>
            ))}
          </SelectField>
          <TextField label={dict.incidents.fields.startedAt} type="datetime-local" max={nowLocalInput()} required {...form.field("startedAt")} />
          <TextAreaField label={dict.incidents.fields.description} required className="md:col-span-2" placeholder={dict.incidents.descriptionPlaceholder} {...form.field("description")} />
          <TextField label={dict.incidents.fields.filingNumber} hint={dict.incidents.filingHint} {...form.field("filingNumber")} />
          <FileField label={dict.incidents.fields.evidence} value={evidence} onChange={setEvidence} />
          <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
            <Button variant="tonal" onClick={() => router.push(href("/incidentes"))}>
              {dict.common.cancel}
            </Button>
            <Button type="submit">{dict.incidents.report}</Button>
          </div>
        </form>
      </Card>
    </>
  );
}
