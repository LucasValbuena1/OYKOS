"use client";
import { AlertTriangle, CheckCircle2, Clock, Percent } from "lucide-react";
import type { TaxDisplayStatus } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/Feedback";

export function TaxStatusBadge({ status }: { status: TaxDisplayStatus }) {
  const { dict } = useI18n();
  if (status === "pagado")
    return (
      <Badge tone="success">
        <CheckCircle2 aria-hidden="true" className="size-3" /> {dict.taxStatus.pagado}
      </Badge>
    );
  if (status === "vencido")
    return (
      <Badge tone="danger">
        <AlertTriangle aria-hidden="true" className="size-3" /> {dict.taxStatus.vencido}
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <Clock aria-hidden="true" className="size-3" /> {dict.taxStatus.pendiente}
    </Badge>
  );
}

export function EarlyPaymentBadge() {
  const { dict } = useI18n();
  return (
    <Badge tone="info">
      <Percent aria-hidden="true" className="size-3" /> {dict.taxes.discount.badge}
    </Badge>
  );
}
