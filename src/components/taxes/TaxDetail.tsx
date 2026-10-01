"use client";
// Felipe · F3 — detalle del impuesto: HU11 editar, HU12 eliminar, HU13 plan de
// cuotas, HU14 descuento pronto pago, HU15 marcar como pagado, HU16 histórico.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Pencil, RotateCcw, Trash2, AlertTriangle, TrendingUp } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAssetName, useTaxDetail } from "@/hooks/useTaxDetail";
import { useToast } from "@/components/ui/Toast";
import { Card, BarChart } from "@/components/ui/Surface";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { EmptyState, InfoNote, Badge } from "@/components/ui/Feedback";
import { SegmentedControl, TextField } from "@/components/ui/Field";
import { FileField } from "@/components/ui/FileField";
import { ConfirmDialog } from "@/components/ui/Modal";
import { TaxStatusBadge, EarlyPaymentBadge } from "./TaxStatusBadge";
import { discountedAmount, validateDiscount } from "@/lib/domain/taxes";
import { daysUntil, toISODate, addDays } from "@/lib/utils";
import type { Attachment } from "@/types";

type Detail = ReturnType<typeof useTaxDetail>;

function InstallmentPlan({ ctx }: { ctx: Detail }) {
  const { dict, money, t } = useI18n();
  const { notify } = useToast();
  const tax = ctx.tax!;
  const [count, setCount] = useState(tax.installments.length || 4);
  const [firstDue, setFirstDue] = useState(tax.installments[0]?.dueDate ?? tax.dueDate);
  const locked = tax.status === "pagado";

  return (
    <Card aria-labelledby="plan-title" className="flex flex-col gap-5">
      <h2 id="plan-title" className="text-xl font-bold">
        {dict.taxes.plan.title}
      </h2>
      <SegmentedControl
        label={dict.taxes.plan.mode}
        name="paymentMode"
        value={tax.paymentMode}
        onChange={(mode) => {
          if (locked) return;
          if (mode === "contado") ctx.setCash();
          else ctx.createPlan(count, firstDue);
        }}
        options={[
          { value: "contado", label: dict.taxes.plan.cash },
          { value: "cuotas", label: dict.taxes.plan.installments },
        ]}
      />
      {tax.paymentMode === "cuotas" && (
        <>
          <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <TextField label={dict.taxes.plan.count} type="number" min={2} max={12} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} disabled={locked} />
            <TextField label={dict.taxes.plan.firstDue} type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} disabled={locked} />
            <Button
              variant="tonal"
              disabled={locked || count < 2 || !firstDue}
              onClick={() => {
                ctx.createPlan(count, firstDue);
                notify(dict.taxes.plan.generated);
              }}
            >
              {dict.taxes.plan.generate}
            </Button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-surface-high">
            <table className="w-full min-w-[520px] text-left">
              <caption className="sr-only">{dict.taxes.plan.title}</caption>
              <thead className="bg-surface-low text-xs tracking-wider text-on-surface-variant uppercase">
                <tr>
                  <th scope="col" className="px-4 py-3">#</th>
                  <th scope="col" className="px-4 py-3">{dict.taxes.plan.amount}</th>
                  <th scope="col" className="px-4 py-3">{dict.taxes.plan.dueDate}</th>
                  <th scope="col" className="px-4 py-3">{dict.taxes.plan.status}</th>
                </tr>
              </thead>
              <tbody>
                {tax.installments.map((c) => (
                  <tr key={c.number} className="border-t border-surface-high">
                    <th scope="row" className="px-4 py-2 font-bold">
                      {c.number}
                    </th>
                    <td className="px-4 py-2">
                      <label className="sr-only" htmlFor={`amount-${c.number}`}>
                        {t(dict.taxes.plan.amountOf, { n: c.number })}
                      </label>
                      <input
                        id={`amount-${c.number}`}
                        type="number"
                        min={0}
                        value={c.amount}
                        disabled={locked || c.paid}
                        onChange={(e) => ctx.updateInstallment(c.number, { amount: Number(e.target.value) })}
                        className="h-10 w-36 rounded-lg bg-surface-container px-3"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <label className="sr-only" htmlFor={`due-${c.number}`}>
                        {t(dict.taxes.plan.dueOf, { n: c.number })}
                      </label>
                      <input
                        id={`due-${c.number}`}
                        type="date"
                        value={c.dueDate}
                        disabled={locked || c.paid}
                        onChange={(e) => ctx.updateInstallment(c.number, { dueDate: e.target.value })}
                        className="h-10 rounded-lg bg-surface-container px-3"
                      />
                    </td>
                    <td className="px-4 py-2">
                      {c.paid ? (
                        <Badge tone="success">{dict.taxStatus.pagado}</Badge>
                      ) : (
                        <Button size="sm" variant="ghost" disabled={locked} onClick={() => ctx.payInstallment(c.number, toISODate(new Date()))}>
                          {dict.taxes.plan.payInstallment}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-high font-bold">
                  <td className="px-4 py-3">{dict.taxes.plan.total}</td>
                  <td className="px-4 py-3" colSpan={3}>
                    {money(ctx.derived!.installmentsTotal)} / {money(tax.amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {!ctx.derived!.installmentsMatch && (
            <div role="alert" className="flex items-center gap-2 rounded-xl bg-error-container px-4 py-3 text-sm font-semibold text-on-error-container">
              <AlertTriangle aria-hidden="true" className="size-4" />
              {t(dict.taxes.plan.mismatch, { diff: money(tax.amount - ctx.derived!.installmentsTotal) })}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function DiscountSection({ ctx }: { ctx: Detail }) {
  const { dict, money, date, t } = useI18n();
  const { notify } = useToast();
  const tax = ctx.tax!;
  const [percent, setPercent] = useState(tax.discount?.percent ?? 10);
  const [deadline, setDeadline] = useState(tax.discount?.deadline ?? "");
  const [submitted, setSubmitted] = useState(false);
  const errors = validateDiscount(percent, deadline);

  return (
    <Card aria-labelledby="discount-title" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="discount-title" className="text-xl font-bold">
          {dict.taxes.discount.title}
        </h2>
        {ctx.derived!.discountActive && <EarlyPaymentBadge />}
      </div>
      {tax.discount && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-container px-5 py-4">
            <p className="text-sm text-on-surface-variant">{t(dict.taxes.discount.valueWith, { percent: tax.discount.percent })}</p>
            <p className="text-2xl font-bold text-secondary" data-testid="discounted-value">
              {money(discountedAmount(tax.amount, tax.discount.percent))}
            </p>
          </div>
          <div className="rounded-xl bg-surface-container px-5 py-4">
            <p className="text-sm text-on-surface-variant">{dict.taxes.discount.deadline}</p>
            <p className="text-2xl font-bold">{date(tax.discount.deadline)}</p>
            <p className="text-sm font-semibold text-on-surface-variant">
              {ctx.derived!.discountActive ? t(dict.taxes.discount.remaining, { days: daysUntil(tax.discount.deadline) }) : dict.taxes.discount.expired}
            </p>
          </div>
        </div>
      )}
      <form
        noValidate
        className="grid grid-cols-1 items-end gap-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (errors.percent || errors.deadline) return;
          ctx.saveDiscount(percent, deadline);
          notify(dict.taxes.discount.saved);
        }}
      >
        <TextField label={dict.taxes.discount.percent} name="percent" type="number" min={1} max={99} value={percent} onChange={(e) => setPercent(Number(e.target.value))} error={submitted ? errors.percent : undefined} />
        <TextField label={dict.taxes.discount.deadline} name="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} error={submitted ? errors.deadline : undefined} />
        <Button type="submit" variant="tonal" disabled={tax.status === "pagado"}>
          {dict.common.save}
        </Button>
      </form>
      {tax.discount && (
        <Button variant="ghost" className="w-fit" onClick={ctx.removeDiscount}>
          {dict.taxes.discount.remove}
        </Button>
      )}
    </Card>
  );
}

function PaymentSection({ ctx }: { ctx: Detail }) {
  const { dict, money, date } = useI18n();
  const { notify } = useToast();
  const tax = ctx.tax!;
  const [payDate, setPayDate] = useState(toISODate(new Date()));
  const [amount, setAmount] = useState(ctx.derived!.payable);
  const [attachment, setAttachment] = useState<Attachment | undefined>();

  if (tax.status === "pagado" && tax.payment) {
    return (
      <Card tone="container" aria-labelledby="payment-title" className="flex flex-col gap-4">
        <h2 id="payment-title" className="flex items-center gap-2 text-xl font-bold">
          <CheckCircle2 aria-hidden="true" className="size-5 text-secondary" /> {dict.taxes.payment.paidTitle}
        </h2>
        <p>
          {date(tax.payment.date)} · <strong>{money(tax.payment.amount)}</strong>
        </p>
        {tax.payment.attachment && (
          <a className="font-semibold text-primary underline" href={tax.payment.attachment.dataUrl} download={tax.payment.attachment.name}>
            {dict.taxes.payment.downloadSupport}: {tax.payment.attachment.name}
          </a>
        )}
        <Button
          variant="outline"
          className="w-fit"
          icon={<RotateCcw aria-hidden="true" className="size-4" />}
          onClick={() => {
            ctx.revertPayment();
            notify(dict.taxes.payment.reverted);
          }}
        >
          {dict.taxes.payment.revert}
        </Button>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="payment-title" className="flex flex-col gap-5">
      <h2 id="payment-title" className="text-xl font-bold">
        {dict.taxes.payment.title}
      </h2>
      <div className="flex items-center justify-between rounded-xl bg-surface-container px-5 py-4">
        <span className="font-semibold text-on-surface-variant">{dict.taxes.finalValue}</span>
        <span className="text-2xl font-bold text-primary">{money(ctx.derived!.payable)}</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField label={dict.taxes.payment.date} type="date" value={payDate} max={toISODate(addDays(new Date(), 0))} onChange={(e) => setPayDate(e.target.value)} />
        <TextField label={dict.taxes.payment.amount} type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
      </div>
      <FileField label={dict.taxes.payment.attach} value={attachment} onChange={setAttachment} />
      <Button
        size="lg"
        className="rounded-2xl"
        disabled={!payDate || amount <= 0}
        icon={<CheckCircle2 aria-hidden="true" className="size-4" />}
        onClick={() => {
          ctx.markPaid({ date: payDate, amount, attachment });
          notify(dict.taxes.payment.marked);
        }}
      >
        {dict.taxes.payment.mark}
      </Button>
    </Card>
  );
}

function HistorySection({ ctx }: { ctx: Detail }) {
  const { dict, money, percent, t } = useI18n();
  const { history, projection } = ctx.derived!;
  return (
    <Card aria-labelledby="tax-history-title" className="flex flex-col gap-5">
      <h2 id="tax-history-title" className="text-xl font-bold">
        {dict.taxes.history.title}
      </h2>
      {!projection.sufficient ? (
        <InfoNote>{dict.taxes.history.insufficient}</InfoNote>
      ) : (
        <>
          <BarChart
            title={dict.taxes.history.title}
            data={[
              ...history.map((h) => ({ label: String(h.year), value: h.amount })),
              { label: `${projection.nextYear}*`, value: projection.estimate, dashed: true },
            ]}
            formatValue={money}
            highlightLast={false}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface-low p-4">
              <p className="text-sm text-on-surface-variant">{dict.taxes.history.yoy}</p>
              <p className="flex items-center gap-2 text-2xl font-bold" data-testid="tax-yoy">
                <TrendingUp aria-hidden="true" className="size-5 text-tertiary" /> {projection.yoy === null ? "—" : percent(projection.yoy)}
              </p>
            </div>
            <div className="rounded-xl border-2 border-dashed border-primary bg-primary-fixed/30 p-4">
              <p className="text-sm text-on-surface-variant">{t(dict.taxes.history.projection, { year: projection.nextYear })}</p>
              <p className="text-2xl font-bold text-primary" data-testid="tax-projection">
                ≈ {money(projection.estimate)}
              </p>
            </div>
          </div>
          <p className="text-sm text-on-surface-variant">* {dict.taxes.history.disclaimer}</p>
        </>
      )}
    </Card>
  );
}

export function TaxDetail({ id }: { id: string }) {
  const { dict, href, money, date, t } = useI18n();
  const ctx = useTaxDetail(id);
  const assetName = useAssetName();
  const router = useRouter();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);
  const tax = ctx.tax;

  if (!tax || !ctx.derived) return <EmptyState title={dict.taxes.notFound} action={<LinkButton href={href("/impuestos")}>{dict.common.back}</LinkButton>} />;

  const name = `${dict.taxTypes[tax.type]} - ${assetName(tax.assetType, tax.assetId)}`;
  const goEdit = () => router.push(href(`/impuestos/${id}/editar`));

  return (
    <>
      <Link href={href("/impuestos")} className="inline-flex w-fit items-center gap-2 font-semibold text-primary hover:underline">
        <ArrowLeft aria-hidden="true" className="size-4" /> {dict.taxes.backToList}
      </Link>
      <Card tone="low" className="flex flex-col gap-4 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold tracking-widest text-primary uppercase">{t(dict.taxes.yearLabel, { year: tax.year })}</p>
            <h1 className="text-3xl font-extrabold md:text-4xl">{name}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <TaxStatusBadge status={ctx.derived.status} />
              {ctx.derived.discountActive && <EarlyPaymentBadge />}
            </div>
          </div>
          <div className="flex gap-2">
            <IconButton label={t(dict.taxes.editNamed, { name })} onClick={() => (tax.status === "pagado" ? setConfirmEdit(true) : goEdit())}>
              <Pencil aria-hidden="true" className="size-4" />
            </IconButton>
            <IconButton label={t(dict.taxes.deleteNamed, { name })} onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
            </IconButton>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-4">
            <dt className="text-sm text-on-surface-variant">{dict.taxes.fields.amount}</dt>
            <dd className="text-2xl font-extrabold">{money(tax.amount)}</dd>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <dt className="text-sm text-on-surface-variant">{dict.taxes.fields.dueDate}</dt>
            <dd className="text-2xl font-extrabold">{date(tax.dueDate)}</dd>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <dt className="text-sm text-on-surface-variant">{dict.taxes.fields.assetType}</dt>
            <dd className="text-2xl font-extrabold">{dict.taxes.assetTypes[tax.assetType]}</dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="flex flex-col gap-8">
          <InstallmentPlan ctx={ctx} />
          <DiscountSection ctx={ctx} />
        </div>
        <div className="flex flex-col gap-8">
          <PaymentSection ctx={ctx} />
          <HistorySection ctx={ctx} />
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={t(dict.taxes.confirmDeleteTitle, { name })}
        message={dict.taxes.confirmDeleteMessage}
        confirmLabel={dict.common.delete}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          ctx.remove();
          setConfirming(false);
          notify(t(dict.taxes.deleted, { name }));
          router.push(href("/impuestos"));
        }}
      />
      <ConfirmDialog
        open={confirmEdit}
        tone="primary"
        title={dict.taxes.paidEditTitle}
        message={dict.taxes.paidEditWarning}
        confirmLabel={dict.taxes.editAnyway}
        onCancel={() => setConfirmEdit(false)}
        onConfirm={goEdit}
      />
    </>
  );
}
