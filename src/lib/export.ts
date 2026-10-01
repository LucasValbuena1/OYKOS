// Exportación de reportes a PDF (jsPDF, carga diferida) y Excel (.xls XML).
import type { Household, Report } from "@/types";
import { reportFileName, toSpreadsheetXml } from "@/lib/domain/reports";

export interface ExportLabels {
  title: string;
  household: string;
  range: string;
  generated: string;
  total: string;
  previous: string;
  variation: string;
  columns: [string, string, string, string];
  formatMoney: (v: number) => string;
  formatRow: (row: Report["data"]["rows"][number]) => [string, string, string, string];
  rangeText: string;
  generatedText: string;
  variationText: string;
}

export function downloadBlob(content: BlobPart, type: string, fileName: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildExcel(report: Report, household: Household, labels: ExportLabels) {
  const xml = toSpreadsheetXml(
    labels.title,
    labels.columns,
    [
      [labels.title, ""],
      [labels.household, household.name],
      [labels.range, labels.rangeText],
      [labels.generated, labels.generatedText],
      [labels.total, labels.formatMoney(report.data.total)],
      [labels.previous, labels.formatMoney(report.data.previousTotal)],
      [labels.variation, labels.variationText],
    ],
    report.data.rows.map((r) => {
      const [a, b, , d] = labels.formatRow(r);
      return [a, b, r.amount, d];
    }),
  );
  return { content: xml, fileName: reportFileName(report, household, "xls") };
}

export async function exportExcel(report: Report, household: Household, labels: ExportLabels) {
  const { content, fileName } = buildExcel(report, household, labels);
  downloadBlob(content, "application/vnd.ms-excel", fileName);
  return fileName;
}

export async function exportPdf(report: Report, household: Household, labels: ExportLabels) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(36, 83, 76);
  doc.text("Oykos", 14, 20);
  doc.setFontSize(13);
  doc.setTextColor(19, 30, 27);
  doc.text(labels.title, 14, 30);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`${labels.household}: ${household.name}`, 14, 40);
  doc.text(`${labels.range}: ${labels.rangeText}`, 14, 46);
  doc.text(`${labels.generated}: ${labels.generatedText}`, 14, 52);
  doc.setFont("helvetica", "bold");
  doc.text(`${labels.total}: ${labels.formatMoney(report.data.total)}`, 14, 62);
  doc.setFont("helvetica", "normal");
  doc.text(`${labels.previous}: ${labels.formatMoney(report.data.previousTotal)}  ·  ${labels.variation}: ${labels.variationText}`, 14, 68);
  autoTable(doc, {
    startY: 76,
    head: [labels.columns],
    body: report.data.rows.map(labels.formatRow),
    headStyles: { fillColor: [36, 83, 76] },
    alternateRowStyles: { fillColor: [234, 246, 242] },
  });
  const fileName = reportFileName(report, household, "pdf");
  doc.save(fileName);
  return fileName;
}
