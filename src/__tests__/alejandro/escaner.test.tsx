// Alejandro · Funcionalidad 3 — Escáner de recibos con IA (HU10–HU17).
// La llamada a Claude (/api/ai/scan-receipt) se reemplaza por un fetch
// simulado solo dentro de las pruebas.
import { screen, waitFor, within } from "@testing-library/react";
import { ReceiptScanner } from "@/components/ai/ReceiptScanner";
import { InvoicePaymentPanel } from "@/components/ai/InvoicePaymentPanel";
import { DueRemindersSection, parseReminderDays } from "@/components/ai/DueReminders";
import { invoicesStore, dueRemindersStore } from "@/data/stores";
import { fieldsToReview, isOverdue, matchService, normalizeDate, sanitizeExtraction, validateReceiptFile } from "@/lib/domain/receipts";
import { resolvePaymentLink } from "@/lib/domain/paymentLinks";
import { dueReminders, pruneReminders, validateReminderDays } from "@/lib/domain/reminders";
import { seedServices } from "@/data/seed";
import { addDays, toISODate } from "@/lib/utils";
import type { Invoice } from "@/types";
import { mockRouter, renderApp } from "../test-utils";

const services = seedServices();
const inDays = (n: number) => toISODate(addDays(new Date(), n));

const claudeExtraction = {
  provider: { value: "Enel Colombia", confidence: 0.95 },
  reference: { value: "4829105531", confidence: 0.9 },
  amount: { value: 134700, confidence: 0.92 },
  cutoffDate: { value: inDays(-6), confidence: 0.85 },
  dueDate: { value: inDays(9), confidence: 0.88 },
  period: { value: inDays(-6).slice(0, 7), confidence: 0.6 },
  consumption: { value: null, confidence: 0 },
  serviceType: { value: "energia", confidence: 0.9 },
};

function mockScan(response: { ok: boolean; status?: number; body: unknown }) {
  global.fetch = jest.fn().mockResolvedValue({ ok: response.ok, status: response.status ?? (response.ok ? 200 : 422), json: async () => response.body });
}

const receipt = () => new File(["fake-image"], "recibo-enel.png", { type: "image/png" });

async function scanReceipt() {
  const utils = renderApp(<ReceiptScanner />);
  await utils.user.upload(screen.getByLabelText(/Sube o arrastra tu recibo/), receipt());
  return utils;
}

describe("HU10 · Escanear recibo", () => {
  it("acepta JPG, PNG o PDF de máximo 5 MB", () => {
    expect(validateReceiptFile({ type: "image/png", size: 1000 })).toBeNull();
    expect(validateReceiptFile({ type: "application/pdf", size: 1000 })).toBeNull();
    expect(validateReceiptFile({ type: "image/gif", size: 1000 })).toBe("type");
    expect(validateReceiptFile({ type: "image/jpeg", size: 6 * 1024 * 1024 })).toBe("size");
  });

  it("envía el recibo a la ruta de IA y muestra los pasos del proceso", async () => {
    mockScan({ ok: true, body: { extraction: claudeExtraction } });
    await scanReceipt();
    expect(await screen.findByRole("list", { name: "Progreso del escaneo" })).toBeInTheDocument();
    expect(await screen.findByTestId("extracted-provider")).toHaveTextContent("Enel Colombia");
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body).toMatchObject({ mediaType: "image/png" });
    expect(body.data).toBeTruthy();
  });

  it("si el recibo es ilegible permite reintentar o registrar manualmente", async () => {
    mockScan({ ok: false, status: 422, body: { error: "unreadable" } });
    const { user } = await scanReceipt();
    expect(await screen.findByRole("alert")).toHaveTextContent("no es legible");
    expect(screen.getByRole("link", { name: /Registrar manualmente/ })).toHaveAttribute("href", "/es/facturas/nuevo");
    mockScan({ ok: true, body: { extraction: claudeExtraction } });
    await user.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByTestId("extracted-provider")).toBeInTheDocument();
  });
});

describe("HU11 · Extraer datos del recibo", () => {
  it("normaliza la respuesta de la IA (valores, montos y tipo de servicio)", () => {
    const ex = sanitizeExtraction({
      provider: { value: " EPM ", confidence: 2 },
      amount: { value: "$ 1.234.500", confidence: 0.8 },
      serviceType: { value: "Energía eléctrica", confidence: 0.9 },
    });
    expect(ex.provider).toEqual({ value: "EPM", confidence: 1 });
    expect(ex.amount.value).toBe(1_234_500);
    expect(ex.serviceType.value).toBe("energia");
    expect(ex.reference).toEqual({ value: null, confidence: 0 });
  });

  it("asocia el recibo al servicio por la empresa", () => {
    expect(matchService("ENEL COLOMBIA S.A.", "energia", services)?.id).toBe("s2");
    expect(matchService("Empresa desconocida", null, services)).toBeUndefined();
  });

  it("marca los campos con baja confianza o no detectados", async () => {
    expect(fieldsToReview(claudeExtraction as never)).toEqual(["period", "consumption"]);
    mockScan({ ok: true, body: { extraction: claudeExtraction } });
    await scanReceipt();
    expect(await screen.findByText(/Revisa los campos resaltados antes de guardar/)).toBeInTheDocument();
    expect(screen.getByText("No detectado")).toBeInTheDocument();
    expect(screen.getByText("Revisar · 60%")).toBeInTheDocument();
  });
});

describe("HU12 · Detectar fechas del recibo", () => {
  it("entiende varios formatos de fecha", () => {
    expect(normalizeDate("15/10/2026")).toBe("2026-10-15");
    expect(normalizeDate("15 oct 2026")).toBe("2026-10-15");
    expect(normalizeDate("Oct 15, 2026")).toBe("2026-10-15");
    expect(normalizeDate("31/02/2026")).toBeNull();
  });

  it("precarga fecha de corte y fecha límite en el formulario", async () => {
    mockScan({ ok: true, body: { extraction: claudeExtraction } });
    await scanReceipt();
    expect(await screen.findByLabelText(/Fecha límite de pago/)).toHaveValue(claudeExtraction.dueDate.value);
    expect(screen.getByLabelText(/Fecha de corte/)).toHaveValue(claudeExtraction.cutoffDate.value);
  });

  it("avisa si la fecha límite ya pasó", async () => {
    expect(isOverdue(inDays(-1))).toBe(true);
    mockScan({ ok: true, body: { extraction: { ...claudeExtraction, dueDate: { value: inDays(-2), confidence: 0.9 } } } });
    await scanReceipt();
    expect(await screen.findByText("La fecha límite ya pasó: esta factura está vencida.")).toBeInTheDocument();
  });
});

describe("HU13 · Validar datos antes de guardar", () => {
  it("no guarda si faltan campos obligatorios", async () => {
    mockScan({ ok: true, body: { extraction: claudeExtraction } });
    const { user } = await scanReceipt();
    const before = invoicesStore.get().length;
    await user.click(await screen.findByRole("button", { name: "Confirmar y guardar" }));
    expect(invoicesStore.get()).toHaveLength(before);
  });

  it("al confirmar crea la factura con origen IA y el recibo adjunto", async () => {
    mockScan({ ok: true, body: { extraction: claudeExtraction } });
    const { user } = await scanReceipt();
    await user.type(await screen.findByLabelText(/Consumo/), "210");
    await user.click(screen.getByRole("button", { name: "Confirmar y guardar" }));
    const created = invoicesStore.get().at(-1)!;
    expect(created).toMatchObject({ serviceId: "s2", amount: 134700, source: "ia", reference: "4829105531" });
    expect(created.attachment?.name).toBe("recibo-enel.png");
    expect(mockRouter().push).toHaveBeenCalledWith(`/es/facturas/${created.id}`);
  });

  it("descartar pide confirmación y vuelve al inicio", async () => {
    mockScan({ ok: true, body: { extraction: claudeExtraction } });
    const { user } = await scanReceipt();
    await user.click(await screen.findByRole("button", { name: "Descartar" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Descartar" }));
    await waitFor(() => expect(screen.getByLabelText(/Sube o arrastra tu recibo/)).toBeInTheDocument());
  });
});

const iaInvoice = (overrides: Partial<Invoice> = {}): Invoice => {
  const inv: Invoice = {
    id: "ia1",
    serviceId: "s2",
    householdId: "h1",
    period: inDays(0).slice(0, 7),
    consumption: 200,
    amount: 134700,
    dueDate: inDays(3),
    status: "pendiente",
    source: "ia",
    reference: "4829105531",
    paymentLink: { url: "https://www.enel.com.co", method: "api", obtainedAt: new Date().toISOString() },
    processing: {
      scan: { status: "success" },
      extraction: { status: "success" },
      paymentLink: { status: "success" },
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
  invoicesStore.set([...invoicesStore.get(), inv]);
  return inv;
};

describe("HU14 · Obtener link de pago", () => {
  it("usa la API oficial o el portal web según la empresa", () => {
    expect(resolvePaymentLink("Enel Colombia", "123")).toMatchObject({ ok: true, link: { method: "api" } });
    expect(resolvePaymentLink("ETB", "123")).toMatchObject({ ok: true, link: { method: "scraping" } });
  });

  it("falla sin referencia o con empresa no soportada", () => {
    expect(resolvePaymentLink("Enel", "")).toEqual({ ok: false, error: "noReference" });
    expect(resolvePaymentLink("Essmar", "123")).toEqual({ ok: false, error: "unsupportedProvider" });
  });

  it("muestra el origen del link y la referencia en el detalle", () => {
    renderApp(<InvoicePaymentPanel invoice={iaInvoice()} />);
    expect(screen.getByText("API oficial")).toBeInTheDocument();
    expect(screen.getAllByText("4829105531").length).toBeGreaterThan(0);
  });
});

describe("HU15 · Pagar desde la app", () => {
  it("avisa que saldrá de Oykos y abre el portal en otra pestaña", async () => {
    const { user } = renderApp(<InvoicePaymentPanel invoice={iaInvoice()} />);
    await user.click(screen.getByRole("button", { name: "Pagar" }));
    const link = await screen.findByRole("link", { name: /Ir al portal de pago/ });
    expect(link).toHaveAttribute("href", "https://www.enel.com.co");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("permite marcarla como pagada después", async () => {
    const inv = iaInvoice();
    const { user } = renderApp(<InvoicePaymentPanel invoice={inv} />);
    await user.click(screen.getByRole("button", { name: "Ya pagué" }));
    await user.click(await screen.findByRole("button", { name: /Marcar como pagada/ }));
    expect(invoicesStore.get().find((i) => i.id === inv.id)?.status).toBe("pagada");
  });

  it("sin link muestra cómo pagar por otros canales", () => {
    renderApp(<InvoicePaymentPanel invoice={iaInvoice({ paymentLink: undefined })} />);
    expect(screen.getByTestId("no-payment-link")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pagar" })).not.toBeInTheDocument();
  });
});

describe("HU16 · Estado del procesamiento", () => {
  it("muestra el estado de cada paso", () => {
    renderApp(<InvoicePaymentPanel invoice={iaInvoice()} />);
    expect(screen.getByText("Escaneo del recibo")).toBeInTheDocument();
    expect(screen.getByText("Obtención del link de pago")).toBeInTheDocument();
    expect(screen.getAllByText("Completado")).toHaveLength(3);
  });

  it("explica el error del paso fallido", () => {
    renderApp(<InvoicePaymentPanel invoice={iaInvoice({ paymentLink: undefined, reference: undefined, processing: { scan: { status: "success" }, extraction: { status: "success" }, paymentLink: { status: "error", error: "noReference" } } })} />);
    expect(screen.getByText("El recibo no tiene referencia de pago.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar paso" })).toBeInTheDocument();
  });

  it("reintentar el paso obtiene el link cuando ya hay referencia", async () => {
    const inv = iaInvoice({ paymentLink: undefined, processing: { scan: { status: "success" }, extraction: { status: "success" }, paymentLink: { status: "error", error: "unsupportedProvider" } } });
    const { user } = renderApp(<InvoicePaymentPanel invoice={inv} />);
    await user.click(screen.getByRole("button", { name: "Reintentar paso" }));
    expect(invoicesStore.get().find((i) => i.id === inv.id)?.paymentLink?.url).toBe("https://www.enel.com.co");
  });
});

describe("HU17 · Aviso de vencimiento", () => {
  const settings = { enabled: true, daysBefore: [5, 1] };

  it("avisa facturas pendientes N días antes y no repite el aviso", () => {
    const inv = { id: "x", status: "pendiente", dueDate: inDays(3) } as Invoice;
    const first = dueReminders([inv], settings, []);
    expect(first).toHaveLength(1);
    expect(first[0].daysBefore).toBe(5);
    expect(dueReminders([inv], settings, first)).toHaveLength(0);
  });

  it("no avisa facturas pagadas, vencidas ni con avisos desactivados", () => {
    const paid = { id: "p", status: "pagada", dueDate: inDays(1) } as Invoice;
    const late = { id: "l", status: "pendiente", dueDate: inDays(-1) } as Invoice;
    expect(dueReminders([paid, late], settings, [])).toHaveLength(0);
    expect(dueReminders([{ ...late, dueDate: inDays(1) }], { ...settings, enabled: false }, [])).toHaveLength(0);
    expect(pruneReminders([{ id: "r", invoiceId: "p", daysBefore: 1, dueDate: inDays(1), read: false, createdAt: "" }], [paid])).toHaveLength(0);
  });

  it("valida los días configurados", () => {
    expect(parseReminderDays("5, 1")).toEqual([5, 1]);
    expect(validateReminderDays(parseReminderDays("5, 1"))).toBe(true);
    expect(validateReminderDays(parseReminderDays("40"))).toBe(false);
    expect(validateReminderDays(parseReminderDays("a"))).toBe(false);
  });

  it("muestra el aviso con acceso directo a la factura para pagar", async () => {
    const inv = iaInvoice();
    dueRemindersStore.set([{ id: "r1", invoiceId: inv.id, daysBefore: 5, dueDate: inv.dueDate, read: false, createdAt: new Date().toISOString() }]);
    const { user } = renderApp(<DueRemindersSection />);
    expect(screen.getByTestId("due-reminder")).toHaveTextContent("vence en 3 días");
    const link = screen.getByRole("link", { name: "Ver y pagar" });
    expect(link).toHaveAttribute("href", `/es/facturas/${inv.id}`);
    await user.click(screen.getByRole("button", { name: "Marcar como leída" }));
    expect(dueRemindersStore.get()[0].read).toBe(true);
  });

  it("al desactivar los avisos se ocultan", async () => {
    const { user } = renderApp(<DueRemindersSection />);
    await user.click(screen.getByRole("switch", { name: "Avisos antes de la fecha límite" }));
    expect(screen.queryByText("No tienes facturas próximas a vencer.")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Días de anticipación/)).toBeDisabled();
  });
});
