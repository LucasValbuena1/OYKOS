"use client";
// Alejandro · F1 — HU03 Editar regla · HU04 Eliminar regla.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAlertRules, useNotifications } from "@/hooks/useDomain";
import { useToast } from "@/components/ui/Toast";
import { Card, PageHeader } from "@/components/ui/Surface";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { ConfirmDialog } from "@/components/ui/Modal";
import { AlertRuleForm } from "./AlertRuleForm";
import { useRuleLabels } from "./AlertsView";

export function AlertRuleDetail({ id }: { id: string }) {
  const { dict, href, t } = useI18n();
  const rules = useAlertRules();
  const { evaluate } = useNotifications();
  const router = useRouter();
  const { notify } = useToast();
  const labels = useRuleLabels();
  const [confirming, setConfirming] = useState(false);
  const rule = rules.getById(id);

  if (!rule) return <EmptyState title={dict.alerts.notFound} action={<LinkButton href={href("/alertas")}>{dict.common.back}</LinkButton>} />;

  return (
    <>
      <Link href={href("/alertas")} className="inline-flex w-fit items-center gap-2 font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> {dict.alerts.backToList}
      </Link>
      <PageHeader
        title={dict.alerts.editTitle}
        subtitle={labels.serviceName(rule)}
        actions={
          <Button variant="danger" icon={<Trash2 aria-hidden="true" className="size-4" />} onClick={() => setConfirming(true)}>
            {dict.common.delete}
          </Button>
        }
      />
      <Card className="max-w-xl">
        <AlertRuleForm
          editing
          initial={{ householdId: rule.householdId, serviceId: rule.serviceId, thresholdType: rule.thresholdType, threshold: rule.threshold, channel: rule.channel, active: rule.active }}
          onCancel={() => router.push(href("/alertas"))}
          onSubmit={(values) => {
            rules.update(id, { thresholdType: values.thresholdType, threshold: Number(values.threshold), channel: values.channel, active: values.active });
            evaluate();
            notify(dict.alerts.updated);
            router.push(href("/alertas"));
          }}
        />
      </Card>
      <ConfirmDialog
        open={confirming}
        title={t(dict.alerts.confirmDeleteTitle, { name: labels.serviceName(rule) })}
        message={dict.alerts.confirmDeleteMessage}
        confirmLabel={dict.common.delete}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          rules.remove(id); // las notificaciones generadas se conservan (HU04)
          setConfirming(false);
          notify(dict.alerts.deleted);
          router.push(href("/alertas"));
        }}
      />
    </>
  );
}
