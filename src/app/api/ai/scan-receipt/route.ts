// POST /api/ai/scan-receipt — Alejandro · F3 (HU10–HU12).
// Recibe el recibo en base64 y devuelve los campos leídos por Claude con su
// nivel de confianza.
import { NextResponse } from "next/server";
import { extractReceipt, isClaudeConfigured } from "@/lib/ai/claude";
import { requireSession } from "@/lib/ai/guard";
import { sanitizeExtraction, validateReceiptFile } from "@/lib/domain/receipts";

export const maxDuration = 60;

interface Body {
  mediaType?: string;
  data?: string;
  knownProviders?: { provider: string; type: string }[];
}

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }
  const { mediaType = "", data = "" } = body;
  const size = Math.floor((data.length * 3) / 4);
  const fileError = validateReceiptFile({ type: mediaType, size });
  if (!data || fileError) return NextResponse.json({ error: fileError ?? "badRequest" }, { status: 400 });
  const known = (body.knownProviders ?? []).slice(0, 20);

  if (!isClaudeConfigured()) return NextResponse.json({ error: "aiNotConfigured" }, { status: 503 });

  try {
    const raw = await extractReceipt({ data, mediaType, knownProviders: known.map((k) => k.provider) });
    const extraction = sanitizeExtraction(raw);
    const readable = Object.values(extraction).some((f) => f.value !== null);
    if (!readable) return NextResponse.json({ error: "unreadable" }, { status: 422 });
    return NextResponse.json({ extraction });
  } catch (e) {
    console.error("[scan-receipt] Claude error", e);
    return NextResponse.json({ error: "aiUnavailable" }, { status: 502 });
  }
}
