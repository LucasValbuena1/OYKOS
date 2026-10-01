"use client";
// Alejandro · F1 — HU02 Crear regla / HU03 Editar regla (mismo formulario).
import { useI18n } from "@/i18n/I18nProvider";
import { useForm } from "@/hooks/useForm";
import { useSelectedHousehold, useServices } from "@/hooks/useDomain";
import { SegmentedControl, SelectField, Switch, TextField } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { validateRule, type AlertRuleInput } from "@/lib/domain/alerts";
import { SERVICE_UNITS } from "@/lib/domain/services";

export interface RuleFormValues extends AlertRuleInput {
  active: boolean;
}

export function AlertRuleForm({
  initial,
  editing,
  onSubmit,
  onCancel,
}: {
  initial: RuleFormValues;
  editing?: boolean;
  onSubmit: (values: RuleFormValues) => void;
  onCancel?: () => void;
}) {
  const { dict } = useI18n();
  const { households } = useSelectedHousehold();
  const services = useServices();
  const form = useForm<RuleFormValues>({ initialValues: initial, validate: validateRule, onSubmit });
  const available = services.items.filter((s) => s.householdId === form.values.householdId);
  const service = services.getById(form.values.serviceId);
  const unit = form.values.thresholdType === "valor" ? "$" : service ? SERVICE_UNITS[service.type] : "u";

  return (
    <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-6">
      <SelectField
        label={dict.alerts.fields.household}
        required
        disabled={editing}
        {...form.field("householdId")}
        onChange={(e) => form.setValues((v) => ({ ...v, householdId: e.target.value, serviceId: "" }))}
      >
        <option value="">{dict.common.select}</option>
        {households.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
      </SelectField>
      <SelectField label={dict.alerts.fields.service} required disabled={editing} {...form.field("serviceId")}>
        <option value="">{dict.alerts.fields.servicePlaceholder}</option>
        {available.map((s) => (
          <option key={s.id} value={s.id}>
            {dict.serviceTypes[s.type]} · {s.provider}
          </option>
        ))}
      </SelectField>
      <SegmentedControl
        label={dict.alerts.fields.metric}
        name="thresholdType"
        value={form.values.thresholdType}
        onChange={(v) => form.setField("thresholdType", v)}
        options={[
          { value: "valor", label: dict.alerts.metric.valor },
          { value: "consumo", label: dict.alerts.metric.consumo },
        ]}
      />
      <TextField
        label={dict.alerts.fields.threshold}
        type="number"
        min={0}
        required
        placeholder={form.values.thresholdType === "valor" ? "150000" : "30"}
        prefix={unit}
        {...form.field("threshold")}
      />
      <SelectField label={dict.alerts.fields.channel} {...form.field("channel")}>
        <option value="app">{dict.alerts.channels.app}</option>
        <option value="email">{dict.alerts.channels.email}</option>
        <option value="ambos">{dict.alerts.channels.ambos}</option>
      </SelectField>
      {editing && (
        <div className="flex items-center justify-between rounded-xl bg-surface-container px-4 py-3">
          <span className="font-semibold">{dict.alerts.fields.active}</span>
          <Switch checked={form.values.active} onChange={(v) => form.setField("active", v)} label={dict.alerts.fields.active} />
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-3">
        {onCancel && (
          <Button variant="tonal" onClick={onCancel}>
            {dict.common.cancel}
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1 uppercase">
          {editing ? dict.common.saveChanges : dict.alerts.create}
        </Button>
      </div>
    </form>
  );
}
