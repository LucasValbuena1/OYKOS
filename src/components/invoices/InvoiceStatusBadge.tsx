"use client";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import type { InvoiceDisplayStatus } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";
import { Badge } from "@/components/ui/Feedback";

/** Estado con color + ícono + texto (nunca solo color, a11y). */
export function InvoiceStatusBadge({ status, daysLeft }: { status: InvoiceDisplayStatus; daysLeft?: number }) {
  const { dict, t } = useI18n();
  if (status === "pagada")
    return (
      <Badge tone="success">
        <CheckCircle2 aria-hidden="true" className="size-3" /> {dict.invoiceStatus.pagada}
      </Badge>
    );
  if (status === "vencida")
    return (
      <Badge tone="danger">
        <AlertTriangle aria-hidden="true" className="size-3" /> {dict.invoiceStatus.vencida}
      </Badge>
    );
  if (status === "por_vencer")
    return (
      <Badge tone="danger">
        <Clock aria-hidden="true" className="size-3" />
        {daysLeft === undefined
          ? dict.invoiceStatus.por_vencer
          : daysLeft === 0
            ? dict.invoiceStatus.dueToday
            : t(dict.invoiceStatus.dueInDays, { days: daysLeft })}
      </Badge>
    );
  return <Badge tone="neutral">{dict.invoiceStatus.pendiente}</Badge>;
}
