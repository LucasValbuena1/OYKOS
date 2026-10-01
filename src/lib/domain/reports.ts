// Generación y exportación de reportes (Felipe · Funcionalidad 2).
import type { Household, Invoice, Report, ReportData, ReportType, Service, Tax } from "@/types";
import { addMonths, parseDate, periodRange, sum, toISODate, toPeriod, variation } from "@/lib/utils";
import { breakdownByService } from "./dashboard";

export const REPORT_TYPES: ReportType[] = ["consumo", "gastos", "impuestos"];
export type QuickRange = "1m" | "3m" | "12m";

export interface ReportSelection {
  householdId: string;
  type: ReportType;
  from: string; // YYYY-MM-DD
  to: string;
}

export function quickRange(range: QuickRange, now: Date = new Date()): { from: string; to: string } {
  const months = range === "1m" ? 1 : range === "3m" ? 3 : 12;
  const to = toISODate(now);
  const from = toISODate(addMonths(now, -months));
  return { from, to };
}

export type SelectionError = "household" | "dates" | "order" | null;

export function validateSelection(sel: ReportSelection): SelectionError {
  if (!sel.householdId) return "household";
  if (!sel.from || !sel.to) return "dates";
  if (parseDate(sel.from).getTime() >= parseDate(sel.to).getTime()) return "order";
  return null;
}

const periodOf = (dateISO: string) => toPeriod(parseDate(dateISO));

/** Rango anterior de igual longitud (para la variación). */
function previousRange(from: string, to: string) {
  const f = parseDate(from).getTime();
  const t = parseDate(to).getTime();
  const len = t - f;
  return { from: toISODate(new Date(f - len)), to: toISODate(new Date(f - 1)) };
}

function invoicesIn(invoices: Invoice[], householdId: string, from: string, to: string) {
  const periods = new Set(periodRange(periodOf(from), periodOf(to)));
  return invoices.filter((i) => i.householdId === householdId && periods.has(i.period));
}

function taxesIn(taxes: Tax[], assetIds: Set<string>, from: string, to: string) {
  const f = parseDate(from).getTime();
  const t = parseDate(to).getTime();
  return taxes.filter((x) => {
    const d = parseDate(x.dueDate).getTime();
    return assetIds.has(x.assetId) && d >= f && d <= t;
  });
}

export function generateReportData(
  sel: ReportSelection,
  invoices: Invoice[],
  services: Service[],
  taxes: Tax[],
  vehicleIds: string[] = [],
): ReportData {
  const typeOf = new Map(services.map((s) => [s.id, s.type]));
  const prev = previousRange(sel.from, sel.to);

  if (sel.type === "impuestos") {
    const assets = new Set([sel.householdId, ...vehicleIds]);
    const current = taxesIn(taxes, assets, sel.from, sel.to);
    const before = taxesIn(taxes, assets, prev.from, prev.to);
    const total = sum(current.map((t) => t.amount));
    const previousTotal = sum(before.map((t) => t.amount));
    const monthlyMap = new Map<string, number>();
    for (const t of current) monthlyMap.set(periodOf(t.dueDate), (monthlyMap.get(periodOf(t.dueDate)) ?? 0) + t.amount);
    return {
      total,
      previousTotal,
      variation: variation(total, previousTotal),
      byService: [],
      monthly: periodRange(periodOf(sel.from), periodOf(sel.to)).map((p) => ({ period: p, amount: monthlyMap.get(p) ?? 0 })),
      rows: current.map((t) => ({ label: `${t.type} ${t.year}`, period: periodOf(t.dueDate), amount: t.amount, status: t.status })),
    };
  }

  const current = invoicesIn(invoices, sel.householdId, sel.from, sel.to);
  const before = invoicesIn(invoices, sel.householdId, prev.from, prev.to);
  const total = sum(current.map((i) => i.amount));
  const previousTotal = sum(before.map((i) => i.amount));
  const periods = periodRange(periodOf(sel.from), periodOf(sel.to));
  return {
    total,
    previousTotal,
    variation: variation(total, previousTotal),
    byService: breakdownByService(current, services).map((b) => ({
      serviceType: b.serviceType,
      consumption: b.consumption,
      amount: b.amount,
    })),
    monthly: periods.map((p) => ({ period: p, amount: sum(current.filter((i) => i.period === p).map((i) => i.amount)) })),
    rows: current
      .sort((a, b) => a.period.localeCompare(b.period))
      .map((i) => ({ label: typeOf.get(i.serviceId) ?? "-", period: i.period, amount: i.amount, status: i.status })),
  };
}

export const hasReportData = (data: ReportData) => data.rows.length > 0;

const slug = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

/** Nombre de archivo con hogar y rango (HU07). */
export function reportFileName(report: Pick<Report, "type" | "from" | "to">, household: Pick<Household, "name">, ext: "pdf" | "xls") {
  return `oykos-${report.type}-${slug(household.name)}-${report.from}_${report.to}.${ext}`;
}

/** Historial más reciente primero (HU08). */
export const sortReports = (reports: Report[]) => [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

const esc = (v: string | number) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Genera un libro Excel (SpreadsheetML 2003, extensión .xls) sin dependencias.
 * Excel, LibreOffice y Google Sheets lo abren directamente.
 */
export function toSpreadsheetXml(
  title: string,
  header: string[],
  meta: [string, string][],
  rows: (string | number)[][],
): string {
  const cell = (v: string | number) =>
    typeof v === "number"
      ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`;
  const metaRows = meta.map(([k, v]) => `<Row>${cell(k)}${cell(v)}</Row>`).join("");
  const headRow = `<Row>${header.map(cell).join("")}</Row>`;
  const body = rows.map((r) => `<Row>${r.map(cell).join("")}</Row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="${esc(title).slice(0, 30)}"><Table>${metaRows}<Row></Row>${headRow}${body}</Table></Worksheet>
</Workbook>`;
}
