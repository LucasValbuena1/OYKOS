"use client";
// Alejandro · F1 — HU01 Listar alertas (activar/desactivar desde la lista) y
// HU02 Crear regla (panel derecho). Diseño Figma "alertas".
import Link from "next/link";
import { useState } from "react";
import { Bell, BellRing, ChevronRight, ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAlertRules, useInvoices, useNotifications, useSelectedHousehold, useServices } from "@/hooks/useDomain";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader, ProgressBar } from "@/components/ui/Surface";
import { Badge, EmptyState } from "@/components/ui/Feedback";
import { Switch } from "@/components/ui/Field";
import { LinkButton } from "@/components/ui/Button";
import { ServiceIcon } from "@/components/common/ServiceIcon";
import { AlertRuleForm } from "./AlertRuleForm";
import { emptyRule, ruleProgress, type RuleState } from "@/lib/domain/alerts";
import { SERVICE_UNITS } from "@/lib/domain/services";
import { cx } from "@/lib/utils";
import type { AlertRule } from "@/types";

export function useRuleLabels() {
  const { dict, money, number } = useI18n();
  const services = useServices();
  return {
    serviceName: (rule: AlertRule) => {
      const s = services.getById(rule.serviceId);
      return s ? `${dict.serviceTypes[s.type]} · ${s.provider}` : "—";
    },
    format: (rule: AlertRule, value: number) => {
      if (rule.thresholdType === "valor") return money(value);
      const s = services.getById(rule.serviceId);
      return `${number(value, 1)} ${s ? SERVICE_UNITS[s.type] : ""}`;
    },
  };
}

const STATE_TONE: Record<RuleState, "danger" | "warning" | "success" | "neutral"> = {
  exceeded: "danger",
  near: "warning",
  stable: "success",
  inactive: "neutral",
};

export function AlertsView() {
  const { dict, href, t, plural } = useI18n();
  const rules = useAlertRules();
  const invoices = useInvoices();
  const services = useServices();
  const { households, selectedId } = useSelectedHousehold();
  const { evaluate, unread } = useNotifications();
  const { notify } = useToast();
  const labels = useRuleLabels();
  const [formKey, setFormKey] = useState(0);
  const activeCount = rules.items.filter((r) => r.active).length;

  return (
    <>
      <PageHeader
        title={dict.alerts.title}
        subtitle={dict.alerts.subtitle}
        actions={
          <LinkButton href={href("/alertas/notificaciones")} variant="tonal" icon={<Bell aria-hidden="true" className="size-4" />}>
            {dict.alerts.notificationsCenter}
            {unread > 0 && <Badge tone="danger">{unread}</Badge>}
          </LinkButton>
        }
      />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section aria-labelledby="rules-title" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="rules-title" className="text-xl font-bold tracking-wide uppercase">
              {dict.alerts.rulesTitle}
            </h2>
            <span aria-live="polite" className="rounded-full bg-tertiary-container px-3 py-1 text-sm font-semibold text-on-tertiary-container">
              {plural(dict.alerts.counter, rules.items.length)} · {t(dict.alerts.activeCount, { count: activeCount })}
            </span>
          </div>
          {rules.items.length === 0 ? (
            <EmptyState icon={<BellRing className="size-8" />} title={dict.alerts.emptyTitle} description={dict.alerts.emptyDescription} />
          ) : (
            <ul className="flex flex-col gap-4">
              {rules.items.map((rule) => {
                const progress = ruleProgress(rule, invoices.items);
                const service = services.getById(rule.serviceId);
                const household = households.find((h) => h.id === rule.householdId);
                return (
                  <li key={rule.id} className={cx("relative overflow-hidden rounded-2xl bg-surface-container p-6", !rule.active && "opacity-70")} data-state={progress.state}>
                    <span
                      aria-hidden="true"
                      className={cx(
                        "absolute inset-y-0 left-0 w-1",
                        progress.state === "exceeded" ? "bg-error" : progress.state === "near" ? "bg-tertiary" : "bg-primary",
                      )}
                    />
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <Link href={href(`/alertas/${rule.id}`)} className="flex min-w-0 items-center gap-4 hover:underline">
                        {service ? <ServiceIcon type={service.type} /> : <ShieldAlert aria-hidden="true" />}
                        <span className="min-w-0">
                          <span className="block text-lg font-bold">{labels.serviceName(rule)}</span>
                          <span className="block text-on-surface-variant">
                            {household?.name} · {dict.alerts.metric[rule.thresholdType]} · {dict.alerts.channels[rule.channel]}
                          </span>
                        </span>
                      </Link>
                      <div className="flex items-center gap-3">
                        <Badge tone={STATE_TONE[progress.state]}>{dict.alerts.states[progress.state]}</Badge>
                        <Switch
                          checked={rule.active}
                          label={t(rule.active ? dict.alerts.deactivate : dict.alerts.activate, { name: labels.serviceName(rule) })}
                          onChange={(active) => {
                            rules.update(rule.id, { active });
                            if (active) evaluate();
                            notify(active ? dict.alerts.activated : dict.alerts.deactivated);
                          }}
                        />
                        <Link href={href(`/alertas/${rule.id}`)} aria-label={t(dict.alerts.openRule, { name: labels.serviceName(rule) })} className="rounded-full p-2 hover:bg-surface-high">
                          <ChevronRight aria-hidden="true" className="size-5" />
                        </Link>
                      </div>
                    </div>
                    <div className="mt-6 flex flex-col gap-2">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-on-surface-variant">{dict.alerts.progress}</span>
                        <span>
                          <span className="text-xl font-bold">{labels.format(rule, progress.value)}</span>
                          <span className="text-on-surface-variant"> / {labels.format(rule, rule.threshold)}</span>
                        </span>
                      </div>
                      <ProgressBar
                        value={progress.ratio * 100}
                        label={t(dict.alerts.progressLabel, { percent: progress.percent })}
                        tone={progress.state === "exceeded" ? "danger" : progress.state === "near" ? "warning" : "primary"}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside aria-labelledby="new-rule" className="flex flex-col gap-6">
          <Card className="relative overflow-hidden">
            <span aria-hidden="true" className="absolute -top-12 -right-12 size-32 rounded-full bg-secondary/10" />
            <h2 id="new-rule" className="relative mb-6 text-2xl font-bold">
              {dict.alerts.newRule}
            </h2>
            <AlertRuleForm
              key={formKey}
              initial={{ ...emptyRule(selectedId ?? ""), active: true }}
              onSubmit={(values) => {
                // HU02: la regla queda activa por defecto
                rules.add({ ...values, threshold: Number(values.threshold), active: true, createdAt: new Date().toISOString() });
                evaluate();
                notify(dict.alerts.created);
                setFormKey((k) => k + 1);
              }}
            />
          </Card>
          <p className="rounded-3xl bg-white p-6 text-on-surface-variant italic shadow-sm">{dict.alerts.tagline}</p>
        </aside>
      </div>
    </>
  );
}
