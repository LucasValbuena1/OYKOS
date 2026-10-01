// Validación de las respuestas de Claude del asistente (nunca se confía en
// el JSON del modelo tal cual: se filtran tipos, se recortan textos y se
// acotan los números).
import type { ServiceType } from "@/types";

export interface AssistantRecommendation {
  id: string;
  serviceType: ServiceType;
  estimatedSaving: number;
  /** Textos generados por Claude. */
  title: string;
  reason: string;
}

export interface AssistantAiResult {
  profileExplanation?: string;
  scoreExplanation?: string;
  recommendations: AssistantRecommendation[];
}

const TYPES: ServiceType[] = ["agua", "energia", "gas", "internet", "aseo"];

const clip = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);

export function sanitizeAssistant(raw: unknown, maxSaving: number): AssistantAiResult {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(r.recommendations) ? r.recommendations : [];
  const recommendations = list
    .map((item, i): AssistantRecommendation | null => {
      const x = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const serviceType = String(x.serviceType ?? "") as ServiceType;
      const title = clip(x.title, 90);
      const reason = clip(x.reason, 280);
      const saving = Number(x.estimatedSaving);
      if (!TYPES.includes(serviceType) || !title || !reason) return null;
      return {
        id: `ai-${serviceType}-${i}`,
        serviceType,
        title,
        reason,
        estimatedSaving: Number.isFinite(saving) ? Math.max(0, Math.min(Math.round(saving / 100) * 100, maxSaving)) : 0,
      };
    })
    .filter((x): x is AssistantRecommendation => x !== null)
    .slice(0, 6);
  return {
    profileExplanation: clip(r.profileExplanation, 600),
    scoreExplanation: clip(r.scoreExplanation, 600),
    recommendations,
  };
}
