// Cliente de /api/payment-link (HU14): devuelve el link y el estado del paso
// "Obtención del link de pago" para mostrarlo en la factura (HU16).
import type { PaymentLink, ProcessingStep } from "@/types";

export async function lookupPaymentLink(provider: string, reference: string | undefined): Promise<{ link?: PaymentLink; step: ProcessingStep }> {
  const finishedAt = () => new Date().toISOString();
  if (!reference?.trim()) return { step: { status: "error", error: "noReference", finishedAt: finishedAt() } };
  try {
    const res = await fetch("/api/payment-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, reference }),
    });
    const body = (await res.json().catch(() => ({}))) as { link?: PaymentLink; error?: string };
    if (res.ok && body.link) return { link: body.link, step: { status: "success", finishedAt: finishedAt() } };
    return { step: { status: "error", error: body.error ?? "linkUnavailable", finishedAt: finishedAt() } };
  } catch {
    return { step: { status: "error", error: "linkUnavailable", finishedAt: finishedAt() } };
  }
}
