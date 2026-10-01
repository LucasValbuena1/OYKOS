"use client";
// Gabriela · F3 — HU10 Registrar vehículo · HU11 Editar vehículo.
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { useSelectedHousehold, useVehicles } from "@/hooks/useDomain";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { SelectField, TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { emptyVehicle, normalizePlate, validateVehicle, VEHICLE_TYPES, type VehicleInput } from "@/lib/domain/vehicles";
import type { Vehicle } from "@/types";

function Form({ initial, editing }: { initial: VehicleInput; editing?: Vehicle }) {
  const { dict, href, t } = useI18n();
  const vehicles = useVehicles();
  const { households } = useSelectedHousehold();
  const router = useRouter();
  const { notify } = useToast();
  const validate = useCallback((v: VehicleInput) => validateVehicle(v, vehicles.items, editing?.id), [vehicles.items, editing?.id]);

  const form = useForm<VehicleInput>({
    initialValues: initial,
    validate,
    onSubmit: (values) => {
      const clean = { ...values, plate: normalizePlate(values.plate), brand: values.brand.trim(), model: values.model.trim() };
      const name = `${clean.brand} ${clean.model}`;
      if (editing) {
        vehicles.update(editing.id, clean);
        notify(t(dict.vehicles.updated, { name }));
        router.push(href(`/vehiculos/${editing.id}`));
      } else {
        vehicles.add({ ...clean, createdAt: new Date().toISOString() });
        notify(t(dict.vehicles.created, { name }));
        router.push(href("/vehiculos"));
      }
    },
  });

  return (
    <Card className="max-w-3xl">
      <form noValidate onSubmit={form.handleSubmit} className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TextField
          label={dict.vehicles.fields.plate}
          required
          placeholder="ABC123"
          hint={dict.vehicles.plateHint}
          autoCapitalize="characters"
          {...form.field("plate")}
          onChange={(e) => form.setField("plate", e.target.value.toUpperCase())}
        />
        <SelectField label={dict.vehicles.fields.type} required {...form.field("type")}>
          {VEHICLE_TYPES.map((v) => (
            <option key={v} value={v}>
              {dict.vehicleTypes[v]}
            </option>
          ))}
        </SelectField>
        <TextField label={dict.vehicles.fields.brand} required {...form.field("brand")} />
        <TextField label={dict.vehicles.fields.model} required {...form.field("model")} />
        <TextField label={dict.vehicles.fields.year} type="number" required {...form.field("year")} />
        <SelectField label={dict.vehicles.fields.household} required {...form.field("householdId")}>
          <option value="">{dict.common.select}</option>
          {households.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
        </SelectField>
        <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
          <Button variant="tonal" onClick={() => router.push(editing ? href(`/vehiculos/${editing.id}`) : href("/vehiculos"))}>
            {dict.common.cancel}
          </Button>
          <Button type="submit">{editing ? dict.common.saveChanges : dict.vehicles.create}</Button>
        </div>
      </form>
    </Card>
  );
}

export function VehicleForm({ id }: { id?: string }) {
  const { dict } = useI18n();
  const vehicles = useVehicles();
  const { selectedId } = useSelectedHousehold();
  const editing = id ? vehicles.getById(id) : undefined;
  return (
    <>
      <PageHeader title={id ? dict.vehicles.editTitle : dict.vehicles.createTitle} subtitle={dict.vehicles.formSubtitle} />
      {id && !editing ? (
        <EmptyState title={dict.vehicles.notFound} />
      ) : (
        <Form
          key={editing?.id ?? "new"}
          editing={editing}
          initial={
            editing
              ? { plate: editing.plate, brand: editing.brand, model: editing.model, year: editing.year, type: editing.type, householdId: editing.householdId }
              : emptyVehicle(selectedId ?? "")
          }
        />
      )}
    </>
  );
}
