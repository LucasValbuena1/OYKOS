// POST /api/payment-link — Alejandro · F3 (HU14).
// Recibe la empresa y la referencia de la factura y devuelve el link de pago
// (scraping de la página pública de la empresa o enlace de respaldo).
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/ai/guard";
import { checkLinkRequest } from "@/lib/domain/paymentLinks";
import { resolvePaymentLink } from "@/lib/paymentLinkService";

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;
  let body: { provider?: string; reference?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }
  const check = checkLinkRequest(String(body.provider ?? "").slice(0, 120), body.reference ? String(body.reference).slice(0, 60) : undefined);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 });
  return NextResponse.json({ link: await resolvePaymentLink(check.portal) });
}
