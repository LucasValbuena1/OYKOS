"use client";
// Felipe · F2 — HU05 seleccionar rango/tipo, HU06 generar, HU07 exportar,
// HU08 historial. Diseño Figma "reportes".
import { useState } from "react";
import { Download, Eye, FileSpreadsheet, FileText, History, Trash2, Upload, BarChart3, Table2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useReportBuilder } from "@/hooks/useReportBuilder";
import { useHouseholds } from "@/hooks/useDomain";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, BarChart } from "@/components/ui/Surface";
import { Button, IconButton } from "@/components/ui/Button";
import { ErrorAlert, InfoNote, Spinner, Badge } from "@/components/ui/Feedback";
import { SelectField, TextField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { REPORT_TYPES, hasReportData, reportFileName, type QuickRange } from "@/lib/domain/reports";
import { exportExcel, exportPdf, type ExportLabels } from "@/lib/export";
import type { Household, Report } from "@/types";
import { cx } from "@/lib/utils";

function useExportLabels() {
  const { dict, money, date, period, percent, dateTime } = useI18n();
  return (report: Report): ExportLabels => ({
    title: dict.reports.docTitle[report.type],
    household: dict.reports.fields.household,
    range: dict.reports.fields.range,
    generated: dict.reports.generatedAt,
    total: dict.reports.total,
    previous: dict.reports.previous,
    variation: dict.reports.variation,
    columns: [dict.reports.table.concept, dict.reports.table.period, dict.reports.table.amount, dict.reports.table.status],
    formatMoney: money,
    formatRow: (r) => [
      (dict.serviceTypes as Record<string, string>)[r.label] ?? r.label,
      period(r.period),
      money(r.amount),
      (dict.reports.rowStatus as Record<string, string>)[r.status] ?? r.status,
    ],
    rangeText: `${date(report.from)} – ${date(report.to)}`,
    generatedText: dateTime(report.createdAt),
    variationText: report.data.variation === null ? "—" : percent(report.data.variation),
  });
}

function ExportActions({ report }: { report: Report }) {
  const { dict, t } = useI18n();
  const { notify } = useToast();
  const labelsFor = useExportLabels();
  const [busy, setBusy] = useState<"pdf" | "xls" | null>(null);
  const [failed, setFailed] = useState<"pdf" | "xls" | null>(null);
  const { items: households } = useHouseholds();
  const household = households.find((h) => h.id === report.householdId) ?? ({ name: "hogar" } as Household);

  async function run(kind: "pdf" | "xls") {
    setBusy(kind);
    setFailed(null);
    try {
      const fn = kind === "pdf" ? exportPdf : exportExcel;
      const fileName = await fn(report, household as Household, labelsFor(report));
      notify(t(dict.reports.exported, { file: fileName }));
    } catch {
      setFailed(kind);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Button className="rounded-full" loading={busy === "pdf"} icon={<FileText aria-hidden="true" className="size-4" />} onClick={() => run("pdf")}>
          {dict.reports.downloadPdf}
        </Button>
        <Button variant="outline" className="rounded-full" loading={busy === "xls"} icon={<FileSpreadsheet aria-hidden="true" className="size-4" />} onClick={() => run("xls")}>
          {dict.reports.exportExcel}
        </Button>
      </div>
      {failed && (
        <ErrorAlert action={<Button size="sm" variant="danger" onClick={() => run(failed)}>{dict.common.retry}</Button>}>
          {dict.reports.exportError}
        </ErrorAlert>
      )}
    </div>
  );
}

function ReportPreview({ report }: { report: Report }) {
  const { dict, money, date, period, percent } = useI18n();
  const { items: households } = useHouseholds();
  const household = households.find((h) => h.id === report.householdId);
  const fileName = household ? reportFileName(report, household, "pdf") : "";

  return (
    <section aria-labelledby="preview-title" className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-container p-6">
        <div className="flex items-center gap-4">
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-white shadow">
            <FileText className="size-5 text-primary" />
          </span>
          <div className="min-w-0">
            <h2 id="preview-title" className="truncate text-lg font-bold">
              {fileName}
            </h2>
            <p className="text-sm text-on-surface-variant">{dict.reports.previewSubtitle}</p>
          </div>
        </div>
        {hasReportData(report.data) && <ExportActions report={report} />}
      </div>
      <div className="bg-surface-low p-4 md:p-10">
        <article className="mx-auto flex max-w-3xl flex-col gap-10 rounded-lg bg-white p-6 shadow md:p-12">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-3xl font-extrabold text-primary md:text-4xl">Oykos</p>
              <span aria-hidden="true" className="mt-2 block h-1 w-12 rounded-full bg-primary" />
              <p className="mt-4 text-sm font-semibold tracking-widest text-on-surface-variant uppercase">{dict.reports.docTitle[report.type]}</p>
            </div>
            <div className="text-right text-sm text-on-surface-variant">
              <p className="font-semibold text-on-surface">{household?.name}</p>
              <p>
                {date(report.from)} – {date(report.to)}
              </p>
              <p>ID: #{report.id.slice(-8).toUpperCase()}</p>
            </div>
          </header>
          {!hasReportData(report.data) ? (
            <InfoNote>{dict.reports.noData}</InfoNote>
          ) : (
            <>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="rounded-xl border-l-4 border-primary bg-surface-low p-4">
                  <dt className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.reports.total}</dt>
                  <dd className="text-2xl font-extrabold text-primary" data-testid="report-total">
                    {money(report.data.total)}
                  </dd>
                </div>
                <div className="rounded-xl border-l-4 border-secondary bg-surface-low p-4">
                  <dt className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.reports.previous}</dt>
                  <dd className="text-2xl font-extrabold text-secondary">{money(report.data.previousTotal)}</dd>
                </div>
                <div className="rounded-xl border-l-4 border-tertiary bg-surface-low p-4">
                  <dt className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.reports.variation}</dt>
                  <dd className="text-2xl font-extrabold text-tertiary" data-testid="report-variation">
                    {report.data.variation === null ? "—" : percent(report.data.variation)}
                  </dd>
                </div>
              </dl>
              {report.data.byService.length > 0 && (
                <section aria-labelledby="by-service" className="flex flex-col gap-3">
                  <h3 id="by-service" className="font-bold">
                    {dict.reports.byService}
                  </h3>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {report.data.byService.map((s) => (
                      <li key={s.serviceType} className="flex justify-between rounded-lg bg-surface-low px-4 py-2">
                        <span>{dict.serviceTypes[s.serviceType]}</span>
                        <span className="font-bold">{money(s.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <section aria-labelledby="flow-title" className="flex flex-col gap-4">
                <h3 id="flow-title" className="flex items-center gap-3 font-bold">
                  <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
                    <BarChart3 className="size-4" />
                  </span>
                  {dict.reports.monthlyFlow}
                </h3>
                <BarChart title={dict.reports.monthlyFlow} data={report.data.monthly.map((m) => ({ label: period(m.period, true), value: m.amount }))} formatValue={money} highlightLast={false} />
              </section>
              <section aria-labelledby="table-title" className="flex flex-col gap-4">
                <h3 id="table-title" className="flex items-center gap-3 font-bold">
                  <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
                    <Table2 className="size-4" />
                  </span>
                  {dict.reports.breakdown}
                </h3>
                <div className="max-h-96 overflow-auto rounded-xl border border-surface-high">
                  <table className="w-full min-w-[480px] text-left">
                    <thead className="sticky top-0 bg-surface-low text-xs tracking-wider text-on-surface-variant uppercase">
                      <tr>
                        <th scope="col" className="px-4 py-3">{dict.reports.table.concept}</th>
                        <th scope="col" className="px-4 py-3">{dict.reports.table.period}</th>
                        <th scope="col" className="px-4 py-3">{dict.reports.table.amount}</th>
                        <th scope="col" className="px-4 py-3">{dict.reports.table.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.data.rows.map((r, i) => (
                        <tr key={`${r.label}-${r.period}-${i}`} className="border-t border-surface-high">
                          <td className="px-4 py-3 first-letter:uppercase">{(dict.serviceTypes as Record<string, string>)[r.label] ?? r.label}</td>
                          <td className="px-4 py-3 first-letter:uppercase">{period(r.period)}</td>
                          <td className="px-4 py-3 font-semibold text-primary">{money(r.amount)}</td>
                          <td className="px-4 py-3">
                            <Badge tone={r.status === "pagada" || r.status === "pagado" ? "success" : "neutral"}>
                              {(dict.reports.rowStatus as Record<string, string>)[r.status] ?? r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </article>
      </div>
    </section>
  );
}

export function ReportsView() {
  const { dict, dateTime, date } = useI18n();
  const builder = useReportBuilder();
  const { notify } = useToast();
  const [tab, setTab] = useState<"new" | "history">("new");
  const [toDelete, setToDelete] = useState<Report | null>(null);
  const { selection, update, error } = builder;
  const quick: { value: QuickRange; label: string }[] = [
    { value: "1m", label: dict.reports.quick.lastMonth },
    { value: "3m", label: dict.reports.quick.last3 },
    { value: "12m", label: dict.reports.quick.lastYear },
  ];

  return (
    <>
      <PageHeader
        eyebrow={dict.reports.eyebrow}
        title={dict.reports.title}
        subtitle={dict.reports.subtitle}
        actions={
          <div role="tablist" aria-label={dict.reports.title} className="flex gap-1 rounded-xl bg-surface-container p-2">
            <button role="tab" type="button" aria-selected={tab === "new"} onClick={() => setTab("new")} className={cx("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold uppercase", tab === "new" ? "bg-primary text-white" : "text-on-surface-variant")}>
              <Upload aria-hidden="true" className="size-4" /> {dict.reports.newReport}
            </button>
            <button role="tab" type="button" aria-selected={tab === "history"} onClick={() => setTab("history")} className={cx("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold uppercase", tab === "history" ? "bg-primary text-white" : "text-on-surface-variant")}>
              <History aria-hidden="true" className="size-4" /> {dict.reports.historyTab}
            </button>
          </div>
        }
      />

      {tab === "new" ? (
        <>
          <form
            aria-label={dict.reports.parameters}
            className="flex flex-col gap-6 rounded-3xl bg-white p-6 shadow-sm"
            onSubmit={(e) => {
              e.preventDefault();
              builder.generate();
            }}
          >
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <SelectField label={dict.reports.fields.household} value={selection.householdId} onChange={(e) => update({ householdId: e.target.value })} errorText={error === "household" ? dict.reports.errors.household : undefined}>
                <option value="">{dict.common.select}</option>
                {builder.households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </SelectField>
              <fieldset className="lg:col-span-2">
                <legend className="mb-2 text-sm font-semibold tracking-wide text-on-surface-variant uppercase">{dict.reports.fields.type}</legend>
                <div className="flex flex-wrap gap-3">
                  {REPORT_TYPES.map((type) => (
                    <label key={type} className={cx("flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3", selection.type === type ? "border-primary bg-surface-low" : "border-outline-variant")}>
                      <input type="radio" name="type" value={type} checked={selection.type === type} onChange={() => update({ type })} className="accent-primary" />
                      {dict.reports.types[type]}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            <div className="grid grid-cols-1 items-end gap-6 md:grid-cols-[1fr_1fr_2fr]">
              <TextField label={dict.reports.fields.from} type="date" value={selection.from} onChange={(e) => update({ from: e.target.value })} errorText={error === "order" ? dict.reports.errors.order : error === "dates" && !selection.from ? dict.validation.required : undefined} />
              <TextField label={dict.reports.fields.to} type="date" value={selection.to} onChange={(e) => update({ to: e.target.value })} errorText={error === "dates" && !selection.to ? dict.validation.required : undefined} />
              <fieldset>
                <legend className="mb-2 text-sm font-semibold tracking-wide text-on-surface-variant uppercase">{dict.reports.quick.title}</legend>
                <div className="flex flex-wrap gap-2">
                  {quick.map((q) => (
                    <Button key={q.value} variant="tonal" size="sm" onClick={() => builder.applyQuickRange(q.value)}>
                      {q.label}
                    </Button>
                  ))}
                </div>
              </fieldset>
            </div>
            <Button type="submit" size="lg" className="w-full md:w-80 md:self-end" disabled={!builder.canGenerate} loading={builder.generating} icon={<Eye aria-hidden="true" className="size-4" />}>
              {dict.reports.generate}
            </Button>
          </form>
          {builder.generating ? (
            <div className="flex justify-center rounded-3xl bg-white p-16 text-primary">
              <Spinner size="lg" label={dict.reports.generating} />
            </div>
          ) : (
            builder.current && <ReportPreview report={builder.current} />
          )}
        </>
      ) : (
        <section aria-labelledby="history-title" className="flex flex-col gap-4">
          <h2 id="history-title" className="flex items-center gap-2 text-xl font-bold">
            <History aria-hidden="true" className="size-5" /> {dict.reports.historyTitle}
          </h2>
          {builder.history.length === 0 ? (
            <InfoNote>{dict.reports.historyEmpty}</InfoNote>
          ) : (
            <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
              <table className="w-full min-w-[640px] text-left">
                <caption className="sr-only">{dict.reports.historyTitle}</caption>
                <thead className="bg-surface-low text-xs tracking-wider text-on-surface-variant uppercase">
                  <tr>
                    <th scope="col" className="px-4 py-3">{dict.reports.history.type}</th>
                    <th scope="col" className="px-4 py-3">{dict.reports.fields.household}</th>
                    <th scope="col" className="px-4 py-3">{dict.reports.fields.range}</th>
                    <th scope="col" className="px-4 py-3">{dict.reports.history.generated}</th>
                    <th scope="col" className="px-4 py-3">{dict.reports.history.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {builder.history.map((r) => (
                    <tr key={r.id} className="border-t border-surface-high" data-testid="history-row">
                      <td className="px-4 py-3 font-semibold">{dict.reports.types[r.type]}</td>
                      <td className="px-4 py-3">{builder.households.find((h) => h.id === r.householdId)?.name}</td>
                      <td className="px-4 py-3">
                        {date(r.from)} – {date(r.to)}
                      </td>
                      <td className="px-4 py-3">{dateTime(r.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <IconButton label={dict.reports.history.view} variant="ghost" onClick={() => { builder.open(r); setTab("new"); }}>
                            <Eye aria-hidden="true" className="size-4" />
                          </IconButton>
                          <IconButton label={dict.reports.history.download} variant="ghost" onClick={() => { builder.open(r); setTab("new"); }}>
                            <Download aria-hidden="true" className="size-4" />
                          </IconButton>
                          <IconButton label={dict.common.delete} variant="ghost" onClick={() => setToDelete(r)}>
                            <Trash2 aria-hidden="true" className="size-4" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      <ConfirmDialog
        open={!!toDelete}
        title={dict.reports.confirmDeleteTitle}
        message={dict.reports.confirmDeleteMessage}
        confirmLabel={dict.common.delete}
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) builder.removeReport(toDelete.id);
          setToDelete(null);
          notify(dict.reports.deleted);
        }}
      />
    </>
  );
}
