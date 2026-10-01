"use client";
// Felipe · F1 — HU02 Crear hogar / HU03 Editar hogar (mismo formulario).
import { useRouter } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { useHouseholds } from "@/hooks/useDomain";
import { useForm } from "@/hooks/useForm";
import { useHydrated } from "@/hooks/useStore";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { SelectField, TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { emptyHousehold, PROPERTY_TYPES, STRATA, validateHousehold, type HouseholdInput } from "@/lib/domain/households";
import type { Household } from "@/types";

function Form({ initial, editing }: { initial: HouseholdInput; editing?: Household }) {
  const { dict, href, t } = useI18n();
  const households = useHouseholds();
  const router = useRouter();
  const { notify } = useToast();
  const cancelHref = editing ? href(`/hogares/${editing.id}`) : href("/hogares");

  const form = useForm<HouseholdInput>({
    initialValues: initial,
    validate: validateHousehold,
    onSubmit: (values) => {
      const clean = { ...values, name: values.name.trim(), address: values.address.trim(), city: values.city.trim() };
      if (editing) {
        households.update(editing.id, clean);
        notify(t(dict.households.updated, { name: clean.name }));
        router.push(href(`/hogares/${editing.id}`));
      } else {
        households.add({ ...clean, createdAt: new Date().toISOString() });
        notify(t(dict.households.created, { name: clean.name }));
        router.push(href("/hogares"));
      }
    },
  });

  return (
    <Card className="max-w-3xl">
      <form noValidate onSubmit={form.handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TextField label={dict.households.fields.name} required className="md:col-span-2" placeholder={dict.households.fields.namePlaceholder} {...form.field("name")} />
        <SelectField label={dict.households.fields.type} required {...form.field("type")}>
          {PROPERTY_TYPES.map((p) => (
            <option key={p} value={p}>
              {dict.propertyTypes[p]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label={dict.households.fields.stratum}
          required
          {...form.field("stratum")}
          onChange={(e) => form.setField("stratum", Number(e.target.value))}
        >
          {STRATA.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </SelectField>
        <TextField label={dict.households.fields.address} required placeholder="Calle 123 #45-67" {...form.field("address")} />
        <TextField label={dict.households.fields.city} required placeholder="Bogotá" {...form.field("city")} />
        <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
          <Button variant="tonal" onClick={() => router.push(cancelHref)}>
            {dict.common.cancel}
          </Button>
          <Button type="submit" loading={form.submitting}>
            {editing ? dict.common.saveChanges : dict.households.create}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function HouseholdForm({ id }: { id?: string }) {
  const { dict } = useI18n();
  const households = useHouseholds();
  const hydrated = useHydrated();
  const editing = id ? households.getById(id) : undefined;

  return (
    <>
      <PageHeader
        title={id ? dict.households.editTitle : dict.households.createTitle}
        subtitle={id ? editing?.name : dict.households.createSubtitle}
      />
      {!hydrated ? (
        <LoadingBlock label={dict.common.loading} rows={2} />
      ) : id && !editing ? (
        <EmptyState title={dict.households.notFound} />
      ) : (
        <Form
          key={editing?.id ?? "new"}
          editing={editing}
          initial={editing ? { name: editing.name, type: editing.type, address: editing.address, city: editing.city, stratum: editing.stratum } : emptyHousehold}
        />
      )}
    </>
  );
}
