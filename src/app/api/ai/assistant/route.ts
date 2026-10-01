// POST /api/ai/assistant — Alejandro · F2 (HU07–HU09).
// Los números (predicción, perfil, score) se calculan en la app; Claude
// redacta la explicación y propone recomendaciones de ahorro personalizadas.
import { NextResponse } from "next/server";
import { assistantInsights, isClaudeConfigured } from "@/lib/ai/claude";
import { requireSession } from "@/lib/ai/guard";
import { sanitizeAssistant, type AssistantAiResult } from "@/lib/ai/sanitize";
import { consumptionProfile, currentScore, type AssistantFacts } from "@/lib/domain/assistant";

export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await requireSession();
  if (denied) return denied;

  let body: { facts?: AssistantFacts; locale?: "es" | "en" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }
  const facts = body.facts;
  if (!facts?.household || !Array.isArray(facts.services) || !Array.isArray(facts.monthly)) {
    return NextResponse.json({ error: "badRequest" }, { status: 400 });
  }
  const profile = consumptionProfile(facts);
  // Sin historial suficiente no se llama a Claude: la interfaz lo explica (HU07)
  if (!profile.sufficient) return NextResponse.json({ recommendations: [] } satisfies AssistantAiResult);
  if (!isClaudeConfigured()) return NextResponse.json({ error: "aiNotConfigured" }, { status: 503 });

  try {
    const raw = await assistantInsights({ facts, profile, score: currentScore(facts), locale: body.locale === "en" ? "en" : "es" });
    const maxSaving = Math.max(...facts.services.map((s) => s.avgAmount), 0);
    const clean = sanitizeAssistant(raw, maxSaving);
    if (clean.recommendations.length === 0) return NextResponse.json({ error: "aiUnavailable" }, { status: 502 });
    return NextResponse.json(clean satisfies AssistantAiResult);
  } catch (e) {
    console.error("[assistant] Claude error", e);
    return NextResponse.json({ error: "aiUnavailable" }, { status: 502 });
  }
}
