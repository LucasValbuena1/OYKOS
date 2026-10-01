"use client";
// Alejandro · F3 — en el detalle de la factura:
//   HU14 link de pago (API oficial o portal web), HU15 pagar desde la app,
//   HU16 estado del procesamiento con reintento del paso fallido.
import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, ExternalLink, FileDown, Loader2, RefreshCw, CreditCard } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useInvoices, useServices } from "@/hooks/useDomain";
import { paymentLinkStep, requestExtraction } from "@/hooks/useReceiptScanner";
import { useToast } from "@/components/ui/Toast";
import { Card } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { FileField } from "@/components/ui/FileField";
import type { Attachment, Invoice, ProcessingStep } from "@/types";
import { toISODate } from "@/lib/utils";

function StepRow({ label, step, onRetry, retrying }: { label: string; step: ProcessingStep; onRetry?: () => void; retrying?: boolean }) {
  const { dict } = useI18n();
  const Icon = step.status === "success" ? CheckCircle2 : step.status === "error" ? AlertTriangle : CircleDashed;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-surface-low p-4" data-step-status={step.status}>
      <div className="flex items-start gap-3">
        <Icon aria-hidden="true" className={step.status === "success" ? "mt-0.5 size-5 text-secondary" : step.status === "error" ? "mt-0.5 size-5 text-error" : "mt-0.5 size-5 text-outline"} />
        <div>
          <p className="font-bold">{label}</p>
          <p className="text-sm text-on-surface-variant">{(dict.processing.status as Record<string, string>)[step.status]}</p>
          {step.error && <p className="text-sm font-semibold text-error">{(dict.processing.errors as Record<string, string>)[step.error] ?? step.error}</p>}
        </div>
      </div>
      {step.status === "error" && onRetry && (
        <Button size="sm" variant="outline" loading={retrying} icon={<RefreshCw aria-hidden="true" className="size-4" />} onClick={onRetry}>
          {dict.processing.retryStep}
        </Button>
      )}
    </li>
  );
}

export function InvoicePaymentPanel({ invoice }: { invoice: Invoice }) {
  const { dict, date } = useI18n();
  const invoices = useInvoices();
  const services = useServices();
  const { notify } = useToast();
  const [confirmPay, setConfirmPay] = useState(false);
  const [paidOpen, setPaidOpen] = useState(false);
  const [receipt, setReceipt] = useState<Attachment | undefined>();
  const [retrying, setRetrying] = useState<"extraction" | "link" | null>(null);
  const svc = services.getById(invoice.serviceId);
  const proc = invoice.processing;

  const retryLink = () => {
    setRetrying("link");
    const { link, step } = paymentLinkStep(svc?.provider ?? "", invoice.reference);
    invoices.update(invoice.id, { paymentLink: link, processing: proc ? { ...proc, paymentLink: step } : undefined });
    setRetrying(null);
    notify(link ? dict.processing.linkFound : dict.processing.linkStillMissing, link ? "success" : "error");
  };

  const retryExtraction = async () => {
    if (!invoice.attachment || !proc) return;
    setRetrying("extraction");
    try {
      const { extraction } = await requestExtraction(invoice.attachment, services.items);
      // Solo completa lo que falte: nunca pisa datos que el usuario ya validó
      invoices.update(invoice.id, {
        reference: invoice.reference ?? extraction.reference.value ?? undefined,
        cutoffDate: invoice.cutoffDate ?? extraction.cutoffDate.value ?? undefined,
        processing: { ...proc, extraction: { status: "success", finishedAt: new Date().toISOString() } },
      });
      notify(dict.processing.extractionOk);
    } catch {
      invoices.update(invoice.id, { processing: { ...proc, extraction: { status: "error", error: "aiUnavailable", finishedAt: new Date().toISOString() } } });
      notify(dict.processing.extractionFailed, "error");
    } finally {
      setRetrying(null);
    }
  };

  const showPayment = invoice.paymentLink || invoice.reference || proc;
  if (!showPayment) return null;

  return (
    <div className="grid max-w-3xl grid-cols-1 gap-6">
      <Card aria-labelledby="pay-title" className="flex flex-col gap-4">
        <h2 id="pay-title" className="flex items-center gap-2 text-xl font-bold">
          <CreditCard aria-hidden="true" className="size-5 text-primary" /> {dict.payment.title}
        </h2>
        {invoice.reference && (
          <p>
            {dict.payment.reference}: <strong className="font-mono">{invoice.reference}</strong>
          </p>
        )}
        {invoice.cutoffDate && (
          <p>
            {dict.payment.cutoff}: <strong>{date(invoice.cutoffDate)}</strong>
          </p>
        )}
        {invoice.paymentLink ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-sm text-on-surface-variant">
              <Badge tone="info">{invoice.paymentLink.method === "api" ? dict.payment.viaApi : dict.payment.viaPortal}</Badge>
              {svc?.provider}
            </p>
            {invoice.status === "pendiente" ? (
              <div className="flex flex-wrap gap-3">
                <Button icon={<ExternalLink aria-hidden="true" className="size-4" />} onClick={() => setConfirmPay(true)}>
                  {dict.payment.pay}
                </Button>
                <Button variant="tonal" onClick={() => setPaidOpen(true)}>
                  {dict.payment.markPaidAfter}
                </Button>
              </div>
            ) : (
              <Badge tone="success">{dict.invoiceStatus.pagada}</Badge>
            )}
          </>
        ) : (
          <p className="text-on-surface-variant" data-testid="no-payment-link">
            {dict.payment.unavailable}
          </p>
        )}
      </Card>

      {proc && (
        <Card aria-labelledby="proc-title" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="proc-title" className="text-xl font-bold">
              {dict.processing.title}
            </h2>
            <Badge tone="primary">{dict.ai.poweredBy}</Badge>
          </div>
          <ul className="flex flex-col gap-3">
            <StepRow label={dict.processing.steps.scan} step={proc.scan} />
            <StepRow label={dict.processing.steps.extraction} step={proc.extraction} onRetry={invoice.attachment ? retryExtraction : undefined} retrying={retrying === "extraction"} />
            <StepRow label={dict.processing.steps.paymentLink} step={proc.paymentLink} onRetry={retryLink} retrying={retrying === "link"} />
          </ul>
          {invoice.attachment && (
            <a href={invoice.attachment.dataUrl} download={invoice.attachment.name} className="inline-flex w-fit items-center gap-2 font-semibold text-primary underline">
              <FileDown aria-hidden="true" className="size-4" /> {dict.processing.downloadOriginal} ({invoice.attachment.name})
            </a>
          )}
          {retrying && <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary" />}
        </Card>
      )}

      <Modal
        open={confirmPay}
        onClose={() => setConfirmPay(false)}
        title={dict.payment.leaveTitle}
        description={dict.payment.leaveMessage}
        footer={
          <>
            <Button variant="tonal" onClick={() => setConfirmPay(false)}>
              {dict.common.cancel}
            </Button>
            <a
              href={invoice.paymentLink?.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setConfirmPay(false);
                setPaidOpen(true);
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary"
            >
              <ExternalLink aria-hidden="true" className="size-4" /> {dict.payment.goToPortal}
              <span className="sr-only">({dict.payment.newTab})</span>
            </a>
          </>
        }
      >
        {invoice.reference && (
          <p>
            {dict.payment.reference}: <strong className="font-mono">{invoice.reference}</strong>
          </p>
        )}
      </Modal>

      <Modal open={paidOpen} onClose={() => setPaidOpen(false)} title={dict.payment.markPaidTitle} description={dict.payment.markPaidMessage}>
        <FileField label={dict.payment.proof} value={receipt} onChange={setReceipt} />
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="tonal" onClick={() => setPaidOpen(false)}>
            {dict.common.cancel}
          </Button>
          <Button
            icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
            onClick={() => {
              invoices.update(invoice.id, { status: "pagada", paidAt: toISODate(new Date()), ...(receipt ? { paymentProof: receipt } : {}) });
              setPaidOpen(false);
              notify(dict.invoices.markedPaid);
            }}
          >
            {dict.invoices.markPaid}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
