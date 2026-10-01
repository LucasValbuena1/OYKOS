// Datos iniciales de ejemplo del hogar. Las fechas se calculan relativas a "hoy" para que la
// app siempre muestre facturas por vencer, vencidas, descuentos vigentes, etc.
import type {
  AlertRule,
  Household,
  Incident,
  Invoice,
  Service,
  ServiceType,
  Tax,
  Vehicle,
  VehicleExpense,
} from "@/types";
import { addDays, addMonths, shiftPeriod, toISODate, toPeriod } from "@/lib/utils";

export function seedHouseholds(now: Date = new Date()): Household[] {
  const created = addMonths(now, -14).toISOString();
  return [
    { id: "h1", name: "Casa Principal", type: "casa", address: "Calle 123 #45-67", city: "Bogotá", stratum: 4, createdAt: created },
    { id: "h2", name: "Apartamento Playa", type: "apartamento", address: "Carrera 2 #10-30", city: "Santa Marta", stratum: 5, createdAt: created },
  ];
}

export function seedServices(now: Date = new Date()): Service[] {
  const created = addMonths(now, -13).toISOString();
  const s = (id: string, householdId: string, type: ServiceType, provider: string, accountNumber: string, cutoffDay: number): Service => ({
    id, householdId, type, provider, accountNumber, cutoffDay, createdAt: created,
  });
  return [
    s("s1", "h1", "agua", "Acueducto de Bogotá (EAAB)", "847291", 10),
    s("s2", "h1", "energia", "Enel Colombia", "928374", 15),
    s("s3", "h1", "gas", "Vanti", "102938", 20),
    s("s4", "h1", "internet", "ETB", "994821", 5),
    s("s5", "h2", "energia", "Air-e", "551203", 12),
    s("s6", "h2", "agua", "Essmar", "330127", 18),
  ];
}

interface InvoiceProfile {
  serviceId: string;
  householdId: string;
  baseAmount: number;
  baseConsumption: number;
  months: number;
  /** Días relativos a hoy para la fecha límite de la factura del mes actual. */
  currentDueInDays: number;
  currentPaid?: boolean;
  /** Valor exacto de la factura del mes actual (para que calce con el Figma). */
  currentAmount?: number;
}

const PROFILES: InvoiceProfile[] = [
  { serviceId: "s1", householdId: "h1", baseAmount: 82_000, baseConsumption: 18, months: 13, currentDueInDays: 8 },
  { serviceId: "s2", householdId: "h1", baseAmount: 128_000, baseConsumption: 205, months: 13, currentDueInDays: 2, currentAmount: 142_500 },
  { serviceId: "s3", householdId: "h1", baseAmount: 27_000, baseConsumption: 24, months: 13, currentDueInDays: -3, currentAmount: 28_000 },
  { serviceId: "s4", householdId: "h1", baseAmount: 99_900, baseConsumption: 300, months: 13, currentDueInDays: -1, currentPaid: true },
  { serviceId: "s5", householdId: "h2", baseAmount: 96_000, baseConsumption: 180, months: 6, currentDueInDays: 12 },
  { serviceId: "s6", householdId: "h2", baseAmount: 45_000, baseConsumption: 11, months: 2, currentDueInDays: 16 },
];

export function seedInvoices(now: Date = new Date()): Invoice[] {
  const current = toPeriod(now);
  const out: Invoice[] = [];
  for (const p of PROFILES) {
    for (let back = p.months - 1; back >= 0; back--) {
      const period = shiftPeriod(current, -back);
      const factor = 1 + 0.12 * Math.sin((back + p.baseConsumption) * 1.3);
      const isCurrent = back === 0;
      const amount = isCurrent && p.currentAmount ? p.currentAmount : Math.round((p.baseAmount * factor) / 100) * 100;
      const dueDate = isCurrent ? toISODate(addDays(now, p.currentDueInDays)) : toISODate(addDays(addMonths(now, -back), p.currentDueInDays));
      const paid = !isCurrent || !!p.currentPaid;
      out.push({
        id: `i_${p.serviceId}_${period}`,
        serviceId: p.serviceId,
        householdId: p.householdId,
        period,
        consumption: Math.round(p.baseConsumption * factor * 10) / 10,
        amount,
        dueDate,
        status: paid ? "pagada" : "pendiente",
        paidAt: paid ? toISODate(addDays(parseDue(dueDate), -2)) : undefined,
        source: "manual",
        createdAt: addDays(now, -back * 30).toISOString(),
      });
    }
  }
  return out;
}

function parseDue(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function seedVehicles(now: Date = new Date()): Vehicle[] {
  const created = addMonths(now, -10).toISOString();
  return [
    { id: "v1", plate: "ABC123", brand: "Mazda", model: "3 Grand Touring", year: 2022, type: "automovil", householdId: "h1", createdAt: created },
    { id: "v2", plate: "XYZ987", brand: "Volvo", model: "XC90", year: 2023, type: "camioneta", householdId: "h1", createdAt: created },
  ];
}

export function seedVehicleExpenses(now: Date = new Date()): VehicleExpense[] {
  const d = (days: number) => toISODate(addDays(now, -days));
  return [
    { id: "e1", vehicleId: "v1", category: "combustible", description: "Tanqueo", amount: 180_000, date: d(5) },
    { id: "e2", vehicleId: "v1", category: "mantenimiento", description: "Cambio de aceite", amount: 450_000, date: d(35) },
    { id: "e3", vehicleId: "v1", category: "seguro", description: "SOAT", amount: 820_000, date: d(120) },
    { id: "e4", vehicleId: "v2", category: "combustible", description: "Tanqueo", amount: 320_000, date: d(8) },
    { id: "e5", vehicleId: "v2", category: "mantenimiento", description: "Revisión 20.000 km", amount: 1_200_000, date: d(60) },
  ];
}

export function seedTaxes(now: Date = new Date()): Tax[] {
  const year = now.getFullYear();
  const created = addMonths(now, -2).toISOString();
  const paidTax = (id: string, type: Tax["type"], assetType: Tax["assetType"], assetId: string, y: number, amount: number): Tax => ({
    id, type, assetType, assetId, year: y, amount,
    dueDate: `${y}-04-15`,
    status: "pagado",
    paymentMode: "contado",
    installments: [],
    payment: { date: `${y}-04-10`, amount },
    createdAt: created,
  });
  return [
    paidTax("t1", "predial", "hogar", "h1", year - 4, 1_020_000),
    paidTax("t2", "predial", "hogar", "h1", year - 3, 1_080_000),
    paidTax("t3", "predial", "hogar", "h1", year - 2, 1_130_000),
    paidTax("t4", "predial", "hogar", "h1", year - 1, 1_200_000),
    {
      id: "t5",
      type: "predial",
      assetType: "hogar",
      assetId: "h1",
      year,
      amount: 1_260_000,
      dueDate: toISODate(addDays(now, 12)),
      status: "pendiente",
      paymentMode: "contado",
      installments: [],
      discount: { percent: 10, deadline: toISODate(addDays(now, 5)) },
      createdAt: created,
    },
    paidTax("t6", "vehicular", "vehiculo", "v1", year - 1, 800_000),
    {
      id: "t7",
      type: "vehicular",
      assetType: "vehiculo",
      assetId: "v1",
      year,
      amount: 850_000,
      dueDate: toISODate(addDays(now, 120)),
      status: "pendiente",
      paymentMode: "cuotas",
      installments: [
        { number: 1, amount: 425_000, dueDate: toISODate(addDays(now, 60)), paid: false },
        { number: 2, amount: 425_000, dueDate: toISODate(addDays(now, 120)), paid: false },
      ],
      createdAt: created,
    },
    {
      id: "t8",
      type: "valorizacion",
      assetType: "hogar",
      assetId: "h2",
      year,
      amount: 320_000,
      dueDate: toISODate(addDays(now, -6)),
      status: "pendiente",
      paymentMode: "contado",
      installments: [],
      createdAt: created,
    },
  ];
}

export function seedAlertRules(now: Date = new Date()): AlertRule[] {
  const created = addMonths(now, -1).toISOString();
  return [
    { id: "r1", householdId: "h1", serviceId: "s2", thresholdType: "valor", threshold: 150_000, channel: "ambos", active: true, createdAt: created },
    { id: "r2", householdId: "h1", serviceId: "s1", thresholdType: "consumo", threshold: 30, channel: "app", active: true, createdAt: created },
    { id: "r3", householdId: "h1", serviceId: "s3", thresholdType: "valor", threshold: 60_000, channel: "app", active: true, createdAt: created },
    { id: "r4", householdId: "h1", serviceId: "s4", thresholdType: "valor", threshold: 90_000, channel: "email", active: true, createdAt: created },
  ];
}

export function seedIncidents(now: Date = new Date()): Incident[] {
  const year = now.getFullYear();
  const at = (days: number, hours = 0) => new Date(now.getTime() - days * 86_400_000 - hours * 3_600_000).toISOString();
  return [
    {
      id: "inc1",
      code: `INC-${year}-042`,
      serviceId: "s1",
      type: "falla",
      startedAt: at(0, 3),
      description:
        "Se detectó humedad visible y goteo leve en la pared colindante con la ducha del baño principal. Se sospecha fuga en la acometida.",
      filingNumber: "EAAB-778120",
      status: "abierto",
      log: [{ status: "abierto", date: at(0, 3), comment: "El incidente fue registrado en el sistema." }],
      createdAt: at(0, 3),
    },
    {
      id: "inc2",
      code: `INC-${year}-041`,
      serviceId: "s3",
      type: "falla",
      startedAt: at(1, 5),
      description: "El calentador no enciende; la presión del gas parece baja desde ayer en la mañana.",
      filingNumber: "VANTI-55321",
      status: "en_gestion",
      log: [
        { status: "abierto", date: at(1, 5), comment: "Reporte recibido." },
        { status: "en_gestion", date: at(1, 1), comment: "Técnico agendado por la empresa." },
      ],
      createdAt: at(1, 5),
    },
    {
      id: "inc3",
      code: `INC-${year}-038`,
      serviceId: "s4",
      type: "corte",
      startedAt: at(3),
      description: "Microcortes diarios de internet entre las 14:00 y 16:00 horas.",
      status: "cerrado",
      log: [
        { status: "abierto", date: at(3), comment: "Reporte recibido." },
        { status: "resuelto", date: at(2), comment: "La empresa cambió el módem." },
        { status: "cerrado", date: at(2), comment: "Servicio estable." },
      ],
      createdAt: at(3),
      closedAt: toISODate(addDays(now, -2)),
    },
    {
      id: "inc4",
      code: `INC-${year}-035`,
      serviceId: "s2",
      type: "cobro",
      startedAt: at(7),
      description: "Doble facturación de energía en el periodo anterior.",
      filingNumber: "ENEL-99012",
      status: "resuelto",
      log: [
        { status: "abierto", date: at(7), comment: "Reporte recibido." },
        { status: "resuelto", date: at(4), comment: "Enel aplicó nota crédito." },
      ],
      createdAt: at(7),
    },
  ];
}
