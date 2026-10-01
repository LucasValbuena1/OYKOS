"use client";
// Alejandro · F3 — HU10 escanear recibo, HU11 extraer datos (con confianza),
// HU12 detectar fechas, HU13 validar antes de guardar.
import { useRouter } from "next/navigation";
import { useCallback, useId, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, ScanLine, Sparkles, Upload, Circle } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useReceiptScanner, type ScanPhase } from "@/hooks/useReceiptScanner";
import { useServices } from "@/hooks/useDomain";
import { useForm } from "@/hooks/useForm";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, Card } from "@/components/ui/Surface";
import { Badge, InfoNote, Skeleton } from "@/components/ui/Feedback";
import { Button, LinkButton } from "@/components/ui/Button";
import { SelectField, TextField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { fieldsToReview, isOverdue, LOW_CONFIDENCE, matchService, MAX_RECEIPT_BYTES, type ExtractionKey } from "@/lib/domain/receipts";
import { validateInvoice } from "@/lib/domain/invoices";
import type { ReceiptExtraction } from "@/types";
import { cx } from "@/lib/utils";
import type { FormErrors } from "@/lib/validation";

function Steps({ phase }: { phase: ScanPhase }) {
  const { dict } = useI18n();
  const s = dict.scanner.steps;
  const order: ScanPhase[] = ["scanning", "extracting", "review"];
  const idx = order.indexOf(phase);
  const items = [s.upload, s.scan, s.extract];
  return (
    <ol aria-label={dict.scanner.progress} className="flex flex-col gap-3">
      {items.map((label, i) => {
        const done = phase === "review" || i < idx || (i === 0 && idx >= 0);
        const running = !done && i === idx;
        return (
          <li key={label} className="flex items-center gap-3" aria-current={running ? "step" : undefined}>
            {done ? (
              <CheckCircle2 aria-hidden="true" className="size-5 text-secondary" />
            ) : running ? (
              <Loader2 aria-hidden="true" className="size-5 animate-spin text-primary" />
            ) : (
              <Circle aria-hidden="true" className="size-5 text-outline-variant" />
            )}
            <span className={cx("font-semibold", running ? "text-primary" : done ? "text-on-surface" : "text-on-surface-variant")}>{label}</span>
            <span className="sr-only">{done ? dict.scanner.done : running ? dict.scanner.running : dict.scanner.pendingStep}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ReceiptPreview({ dataUrl, type, name }: { dataUrl: string; type: string; name: string }) {
  const { dict } = useI18n();
  return (
    <figure className="flex flex-col gap-2">
      {type === "application/pdf" ? (
        <object data={dataUrl} type="application/pdf" aria-label={dict.scanner.original} className="h-[28rem] w-full rounded-xl bg-surface-low">
          <a href={dataUrl} download={name} className="font-semibold text-primary underline">
            {name}
          </a>
        </object>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt={dict.scanner.original} className="max-h-[28rem] w-full rounded-xl bg-surface-low object-contain" />
      )}
      <figcaption className="text-sm text-on-surface-variant">
        {dict.scanner.original}: {name}
      </figcaption>
    </figure>
  );
}

function ConfidenceBadge({ confidence, empty }: { confidence: number; empty: boolean }) {
  const { dict, t } = useI18n();
  if (empty) return <Badge tone="danger">{dict.scanner.notRead}</Badge>;
  const low = confidence < LOW_CONFIDENCE;
  return (
    <Badge tone={low ? "warning" : "success"}>
      {t(low ? dict.scanner.lowConfidence : dict.scanner.confidence, { value: Math.round(confidence * 100) })}
    </Badge>
  );
}

interface ReviewValues {
  serviceId: string;
  householdId: string;
  reference: string;
  amount: number;
  cutoffDate: string;
  dueDate: string;
  period: string;
  consumption: number;
  source: "ia";
}

function ReviewForm({ extraction, onConfirm, onDiscard }: { extraction: ReceiptExtraction; onConfirm: (v: ReviewValues) => void; onDiscard: () => void }) {
  const { dict, t } = useI18n();
  const services = useServices().items;
  const matched = matchService(extraction.provider.value, extraction.serviceType.value, services);
  const review = fieldsToReview(extraction);
  const labels = dict.scanner.fields as Record<ExtractionKey, string>;

  const validate = useCallback(
    (v: ReviewValues): FormErrors<ReviewValues> => {
      // HU13: mismas validaciones del registro manual
      const e = validateInvoice({ ...v, attachment: undefined }) as FormErrors<ReviewValues>;
      return e;
    },
    [],
  );

  const form = useForm<ReviewValues>({
    initialValues: {
      serviceId: matched?.id ?? "",
      householdId: matched?.householdId ?? "",
      reference: extraction.reference.value ?? "",
      amount: extraction.amount.value ?? 0,
      cutoffDate: extraction.cutoffDate.value ?? "",
      dueDate: extraction.dueDate.value ?? "",
      period: extraction.period.value ?? extraction.dueDate.value?.slice(0, 7) ?? "",
      consumption: extraction.consumption.value ?? 0,
      source: "ia",
    },
    validate,
    onSubmit: onConfirm,
  });

  const mark = (key: ExtractionKey) => {
    const f = extraction[key];
    const flagged = f.value === null || f.confidence < LOW_CONFIDENCE;
    return {
      className: cx(flagged && "rounded-2xl p-3 ring-2", f.value === null ? "ring-error/60 bg-error-container/20" : flagged && "ring-tertiary/60 bg-tertiary-fixed/30"),
      badge: <ConfidenceBadge confidence={f.confidence} empty={f.value === null} />,
    };
  };
  const overdue = isOverdue(form.values.dueDate || null);
  const hintId = useId();

  return (
    <form noValidate onSubmit={form.handleSubmit} className="flex flex-col gap-5" aria-describedby={hintId}>
      {review.length > 0 && (
        <InfoNote tone="warning">
          <span id={hintId}>{t(dict.scanner.reviewFirst, { fields: review.map((k) => labels[k]).join(", ") })}</span>
        </InfoNote>
      )}
      {overdue && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container">
          <AlertTriangle aria-hidden="true" className="size-4" /> {dict.scanner.overdue}
        </p>
      )}
      <div className={mark("provider").className}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold tracking-wide text-on-surface-variant uppercase">{labels.provider}</span>
          {mark("provider").badge}
        </div>
        <p className="font-bold" data-testid="extracted-provider">
          {extraction.provider.value ?? "—"}
        </p>
        <SelectField
          label={dict.scanner.linkedService}
          required
          className="mt-3"
          hint={matched ? dict.scanner.autoMatched : dict.scanner.chooseService}
          {...form.field("serviceId")}
        >
          <option value="">{dict.common.select}</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {dict.serviceTypes[s.type]} · {s.provider}
            </option>
          ))}
        </SelectField>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(
          [
            ["reference", "text"],
            ["amount", "number"],
            ["cutoffDate", "date"],
            ["dueDate", "date"],
            ["period", "month"],
            ["consumption", "number"],
          ] as [Exclude<ExtractionKey, "provider" | "serviceType">, string][]
        ).map(([key, type]) => {
          const m = mark(key);
          return (
            <div key={key} className={m.className} data-flagged={m.className ? "true" : undefined} data-field={key}>
              <div className="mb-1 flex justify-end">{m.badge}</div>
              <TextField label={labels[key]} type={type} required={key !== "reference" && key !== "cutoffDate"} {...form.field(key)} />
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="tonal" onClick={onDiscard}>
          {dict.scanner.discard}
        </Button>
        <Button type="submit" icon={<CheckCircle2 aria-hidden="true" className="size-4" />}>
          {dict.scanner.confirm}
        </Button>
      </div>
    </form>
  );
}

export function ReceiptScanner() {
  const { dict, href, t } = useI18n();
  const scanner = useReceiptScanner();
  const router = useRouter();
  const { notify } = useToast();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const inputId = useId();
  const busy = scanner.phase === "scanning" || scanner.phase === "extracting";

  const fileErrorText = useMemo(() => {
    if (scanner.fileError === "type") return dict.scanner.errors.type;
    if (scanner.fileError === "size") return t(dict.scanner.errors.size, { max: MAX_RECEIPT_BYTES / 1024 / 1024 });
    return null;
  }, [scanner.fileError, dict, t]);

  return (
    <>
      <PageHeader eyebrow={dict.ai.eyebrow} title={dict.scanner.title} subtitle={dict.scanner.subtitle} />

      {scanner.phase === "idle" && (
        <Card className="flex max-w-2xl flex-col gap-4">
          <label
            htmlFor={inputId}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-low px-6 py-12 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary-container"
          >
            <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-full bg-primary text-white">
              <Upload className="size-6" />
            </span>
            <span className="text-lg font-bold">{dict.scanner.upload}</span>
            <span className="text-sm text-on-surface-variant">{t(dict.scanner.formats, { max: MAX_RECEIPT_BYTES / 1024 / 1024 })}</span>
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              className="sr-only"
              aria-describedby={fileErrorText ? `${inputId}-err` : undefined}
              onChange={(e) => scanner.selectFile(e.target.files?.[0])}
            />
          </label>
          {fileErrorText && (
            <p id={`${inputId}-err`} role="alert" className="text-sm font-semibold text-error">
              {fileErrorText}
            </p>
          )}
          <p className="flex items-center gap-2 text-sm text-on-surface-variant">
            <Sparkles aria-hidden="true" className="size-4 text-primary" /> {dict.scanner.privacy}
          </p>
        </Card>
      )}

      {scanner.phase !== "idle" && scanner.attachment && (
        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          <Card className="flex flex-col gap-6">
            <ReceiptPreview dataUrl={scanner.attachment.dataUrl} type={scanner.attachment.type} name={scanner.attachment.name} />
            <Steps phase={scanner.phase} />
          </Card>
          <Card className="flex flex-col gap-5" aria-labelledby="scan-result-title">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="scan-result-title" className="flex items-center gap-2 text-xl font-bold">
                <ScanLine aria-hidden="true" className="size-5 text-primary" /> {dict.scanner.resultTitle}
              </h2>
              {scanner.result && (
                <Badge tone="primary">
                  <Sparkles aria-hidden="true" className="size-3" /> {dict.ai.poweredBy}
                </Badge>
              )}
            </div>
            {busy && (
              <div role="status" aria-live="polite" className="flex flex-col gap-4" data-testid="scan-loading">
                <span className="sr-only">{dict.scanner.processing}</span>
                <p className="flex items-center gap-2 font-semibold text-primary">
                  <Loader2 aria-hidden="true" className="size-5 animate-spin" /> {scanner.phase === "scanning" ? dict.scanner.steps.scan : dict.scanner.steps.extract}…
                </p>
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            )}
            {scanner.phase === "failed" && (
              <div role="alert" className="flex flex-col gap-4 rounded-2xl bg-error-container p-5 text-on-error-container">
                <p className="flex items-center gap-2 font-bold">
                  <AlertTriangle aria-hidden="true" className="size-5" /> {dict.scanner.failedTitle}
                </p>
                <p>{(dict.scanner.errors as Record<string, string>)[scanner.error ?? "network"]}</p>
                <div className="flex flex-wrap gap-3">
                  <Button variant="danger" onClick={scanner.retry}>
                    {dict.common.retry}
                  </Button>
                  <LinkButton href={href("/facturas/nuevo")} variant="outline" icon={<FileText aria-hidden="true" className="size-4" />}>
                    {dict.scanner.manual}
                  </LinkButton>
                </div>
              </div>
            )}
            {scanner.phase === "review" && scanner.result && (
              <ReviewForm
                extraction={scanner.result.extraction}
                onDiscard={() => setConfirmDiscard(true)}
                onConfirm={(v) => {
                  const inv = scanner.confirm(v);
                  notify(inv.paymentLink ? dict.scanner.savedWithLink : dict.scanner.saved);
                  router.push(href(`/facturas/${inv.id}`));
                }}
              />
            )}
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title={dict.scanner.discardTitle}
        message={dict.scanner.discardMessage}
        confirmLabel={dict.scanner.discard}
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          scanner.reset();
        }}
      />
    </>
  );
}
