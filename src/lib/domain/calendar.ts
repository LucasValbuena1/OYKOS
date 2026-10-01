// Calendario de vencimientos: une facturas e impuestos en eventos por día.
import type { Invoice, Tax } from "@/types";
import { invoiceDisplayStatus } from "./invoices";
import { taxDisplayStatus } from "./taxes";

export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  amount: number;
  state: "paid" | "pending" | "overdue";
  href: string;
}

export function buildCalendarEvents(
  invoices: Invoice[],
  taxes: Tax[],
  invoiceTitle: (serviceId: string) => string,
  taxTitle: (tax: Tax) => string,
  now: Date = new Date(),
): CalendarEvent[] {
  const inv = invoices.map<CalendarEvent>((i) => {
    const st = invoiceDisplayStatus(i, now);
    return {
      id: i.id,
      date: i.dueDate,
      title: invoiceTitle(i.serviceId),
      amount: i.amount,
      state: st === "pagada" ? "paid" : st === "vencida" ? "overdue" : "pending",
      href: `/facturas/${i.id}`,
    };
  });
  const tx = taxes.flatMap<CalendarEvent>((t) => {
    const st = taxDisplayStatus(t, now);
    if (t.paymentMode === "cuotas" && t.installments.length) {
      return t.installments.map((c) => ({
        id: `${t.id}-${c.number}`,
        date: c.dueDate,
        title: `${taxTitle(t)} (${c.number}/${t.installments.length})`,
        amount: c.amount,
        state: c.paid ? "paid" : new Date(`${c.dueDate}T23:59`) < now ? "overdue" : "pending",
        href: `/impuestos/${t.id}`,
      }));
    }
    return [
      {
        id: t.id,
        date: t.dueDate,
        title: taxTitle(t),
        amount: t.amount,
        state: st === "pagado" ? "paid" : st === "vencido" ? "overdue" : "pending",
        href: `/impuestos/${t.id}`,
      },
    ];
  });
  return [...inv, ...tx].sort((a, b) => a.date.localeCompare(b.date));
}

/** Semanas (domingo a sábado) que cubren el mes del cursor. */
export function monthMatrix(cursor: Date): Date[][] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const weeks: Date[][] = [];
  const day = new Date(start);
  do {
    if (day.getDay() === 0) weeks.push([]);
    weeks[weeks.length - 1].push(new Date(day));
    day.setDate(day.getDate() + 1);
  } while (day <= last || day.getDay() !== 0);
  return weeks;
}
