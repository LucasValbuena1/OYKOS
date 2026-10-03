// Modelos de datos del dominio de Oykos.
// Todas las fechas se guardan como string ISO (YYYY-MM-DD o ISO completo)
// para que se puedan serializar sin problema en localStorage / API.

export type ID = string;

export interface Attachment {
  name: string;
  type: string;
  size: number;
  /** Contenido como data URL (se guarda en localStorage; no hay backend). */
  dataUrl: string;
}

// ---------- Usuario (Lucas F3) ----------
// La identidad viene de Auth0; phone/photo/name visible son datos propios de Oykos.
export interface User {
  id: ID; // "sub" de Auth0
  name: string;
  email: string;
  phone: string;
  photo?: string;
  emailVerified: boolean;
  /** El inicio de sesión actual usó verificación en dos pasos (HU11). */
  mfaVerified: boolean;
}

// ---------- Hogares (Felipe F1) ----------
export type PropertyType = "casa" | "apartamento" | "local";

export interface Household {
  id: ID;
  name: string;
  type: PropertyType;
  address: string;
  city: string;
  stratum: number;
  createdAt: string;
}

// ---------- Servicios (Lucas F1) ----------
export type ServiceType = "agua" | "energia" | "gas" | "internet" | "aseo";

export interface Service {
  id: ID;
  householdId: ID;
  type: ServiceType;
  provider: string;
  accountNumber: string;
  cutoffDay: number;
  createdAt: string;
}

// ---------- Facturas (Gabriela F1) ----------
export type InvoiceStatus = "pendiente" | "pagada";
export type InvoiceDisplayStatus = InvoiceStatus | "vencida" | "por_vencer";

export interface Invoice {
  id: ID;
  serviceId: ID;
  householdId: ID;
  /** Periodo facturado, formato YYYY-MM. */
  period: string;
  consumption: number;
  amount: number;
  dueDate: string;
  status: InvoiceStatus;
  paidAt?: string;
  source: "manual" | "foto" | "ia";
  attachment?: Attachment;
  /** Número de referencia de pago (leído por la IA o digitado). */
  reference?: string;
  /** Fecha de corte del recibo (HU12 Alejandro). */
  cutoffDate?: string;
  paymentLink?: PaymentLink;
  /** Comprobante de pago adjuntado al marcarla como pagada (HU15). */
  paymentProof?: Attachment;
  processing?: ScanProcessing;
  createdAt: string;
}

// ---------- Escáner de recibos con IA (Alejandro F3) ----------
export type StepStatus = "pending" | "running" | "success" | "error" | "skipped";

export interface ProcessingStep {
  status: StepStatus;
  /** Clave del mensaje de error para el usuario (se traduce en la UI). */
  error?: string;
  finishedAt?: string;
}

export interface ScanProcessing {
  scan: ProcessingStep;
  extraction: ProcessingStep;
  paymentLink: ProcessingStep;
}

export interface PaymentLink {
  url: string;
  /** scraping: leído de la página pública de la empresa · fallback: enlace de respaldo. */
  method: "scraping" | "fallback";
  /** Página de la empresa de donde se obtuvo el enlace (solo scraping). */
  sourcePage?: string;
  /** ia: lo eligió Claude · patron: patrón conocido de la empresa. */
  engine?: "ia" | "patron";
  /** Páginas que se revisaron hasta encontrarlo. */
  pagesVisited?: number;
  /** Se leyó con un navegador sin interfaz (página armada con JavaScript). */
  rendered?: boolean;
  obtainedAt: string;
}

export interface ExtractedField<T> {
  value: T | null;
  /** 0 a 1 */
  confidence: number;
}

export interface ReceiptExtraction {
  provider: ExtractedField<string>;
  reference: ExtractedField<string>;
  amount: ExtractedField<number>;
  cutoffDate: ExtractedField<string>;
  dueDate: ExtractedField<string>;
  period: ExtractedField<string>;
  consumption: ExtractedField<number>;
  serviceType: ExtractedField<ServiceType>;
}

export interface DueReminder {
  id: ID;
  invoiceId: ID;
  daysBefore: number;
  dueDate: string;
  read: boolean;
  createdAt: string;
}

export interface ReminderSettings {
  enabled: boolean;
  daysBefore: number[];
}

// ---------- Asistente IA (Alejandro F2) ----------
export type ConsumptionLevel = "bajo" | "moderado" | "alto";

export interface Recommendation {
  id: string;
  serviceType: ServiceType;
  title: string;
  reason: string;
  /** Ahorro mensual estimado en COP. */
  estimatedSaving: number;
}

// ---------- Impuestos (Felipe F3) ----------
export type TaxType = "predial" | "vehicular" | "valorizacion";
export type TaxAssetType = "hogar" | "vehiculo";
export type TaxStatus = "pendiente" | "pagado";
export type TaxDisplayStatus = TaxStatus | "vencido";

export interface Installment {
  number: number;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidAt?: string;
}

export interface TaxPayment {
  date: string;
  amount: number;
  attachment?: Attachment;
}

export interface Tax {
  id: ID;
  type: TaxType;
  assetType: TaxAssetType;
  assetId: ID;
  year: number;
  amount: number;
  dueDate: string;
  status: TaxStatus;
  paymentMode: "contado" | "cuotas";
  installments: Installment[];
  discount?: { percent: number; deadline: string };
  payment?: TaxPayment;
  createdAt: string;
}

// ---------- Vehículos (Gabriela F3) ----------
export type VehicleType = "automovil" | "camioneta" | "moto" | "otro";

export interface Vehicle {
  id: ID;
  plate: string;
  brand: string;
  model: string;
  year: number;
  type: VehicleType;
  householdId: ID;
  createdAt: string;
}

export type VehicleExpenseCategory = "combustible" | "mantenimiento" | "seguro" | "otro";

export interface VehicleExpense {
  id: ID;
  vehicleId: ID;
  category: VehicleExpenseCategory;
  description: string;
  amount: number;
  date: string;
}

// ---------- Alertas (Alejandro F1) ----------
export type ThresholdType = "consumo" | "valor";
export type NotificationChannel = "app" | "email" | "ambos";

export interface AlertRule {
  id: ID;
  householdId: ID;
  serviceId: ID;
  thresholdType: ThresholdType;
  threshold: number;
  channel: NotificationChannel;
  active: boolean;
  createdAt: string;
}

export interface AppNotification {
  id: ID;
  ruleId: ID;
  serviceId: ID;
  householdId: ID;
  period: string;
  thresholdType: ThresholdType;
  threshold: number;
  value: number;
  read: boolean;
  createdAt: string;
}

// ---------- Incidentes (Lucas F2) ----------
export type IncidentType = "corte" | "falla" | "cobro";
export type IncidentStatus = "abierto" | "en_gestion" | "resuelto" | "cerrado";

export interface IncidentLogEntry {
  status: IncidentStatus;
  date: string;
  comment: string;
}

export interface Incident {
  id: ID;
  code: string;
  serviceId: ID;
  type: IncidentType;
  startedAt: string;
  description: string;
  filingNumber?: string;
  evidence?: Attachment;
  status: IncidentStatus;
  log: IncidentLogEntry[];
  createdAt: string;
  closedAt?: string;
}

// ---------- Reportes (Felipe F2) ----------
export type ReportType = "consumo" | "gastos" | "impuestos";

export interface ReportServiceRow {
  serviceType: ServiceType;
  consumption: number;
  amount: number;
}

export interface ReportData {
  total: number;
  previousTotal: number;
  /** Variación porcentual frente al periodo anterior (null si no hay base). */
  variation: number | null;
  byService: ReportServiceRow[];
  /** Serie mensual para la gráfica de evolución. */
  monthly: { period: string; amount: number }[];
  rows: { label: string; period: string; amount: number; status: string }[];
}

export interface Report {
  id: ID;
  householdId: ID;
  type: ReportType;
  from: string;
  to: string;
  createdAt: string;
  data: ReportData;
}
