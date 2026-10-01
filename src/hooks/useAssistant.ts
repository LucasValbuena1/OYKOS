"use client";
// useAssistant — Alejandro · F2 (HU06–HU09). Calcula en la app predicción,
// perfil y score (deterministas) y pide a Claude (vía /api/ai/assistant) la
// explicación y las recomendaciones. Vuelve a consultar solo cuando cambian
// los datos del hogar (huella) y guarda la respuesta para no gastar créditos.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Household } from "@/types";
import { useInvoices, useServices } from "./useDomain";
import { useStore } from "./useStore";
import { assistantCacheStore, dismissedRecommendationsStore } from "@/data/stores";
import {
  buildFacts,
  consumptionProfile,
  currentScore,
  factsFingerprint,
  predictions,
  scoreHistory,
  scoreRange,
} from "@/lib/domain/assistant";
import type { AssistantAiResult } from "@/lib/ai/sanitize";

export type AiState = "idle" | "loading" | "ready" | "error";

export function useAssistant(household: Household | null, locale: "es" | "en") {
  const invoices = useInvoices();
  const services = useServices();
  const [cache, setCache] = useStore(assistantCacheStore);
  const [dismissedMap, setDismissed] = useStore(dismissedRecommendationsStore);
  const [state, setState] = useState<AiState>("idle");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const computed = useMemo(() => {
    if (!household) return null;
    const facts = buildFacts(household, services.items, invoices.items);
    const profile = consumptionProfile(facts);
    const score = currentScore(facts);
    return {
      facts,
      profile,
      predictions: predictions(household, services.items, invoices.items),
      score,
      scoreRange: score ? scoreRange(score.value) : null,
      history: scoreHistory(household.id, services.items, invoices.items, 6),
      key: `${factsFingerprint(facts)}|${locale}`,
    };
  }, [household, services.items, invoices.items, locale]);

  const cached = computed ? (cache[computed.key] as AssistantAiResult | undefined) : undefined;

  useEffect(() => {
    if (!computed || !computed.profile.sufficient || cached) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado de carga de una petición externa
    setState("loading");
    fetch("/api/ai/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facts: computed.facts, locale }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(res.status === 401 ? "unauthorized" : (body.error ?? "aiUnavailable"));
        }
        const data = (await res.json()) as AssistantAiResult;
        setCache((prev) => ({ ...prev, [computed.key]: data }));
        setState("ready");
      })
      .catch((e: unknown) => {
        if ((e as Error).name === "AbortError") return;
        setErrorCode((e as Error).message);
        setState("error");
      });
    return () => controller.abort();
  }, [computed, cached, locale, setCache, attempt]);

  const dismissed = useMemo(() => (household ? dismissedMap[household.id] ?? [] : []), [dismissedMap, household]);

  const dismiss = useCallback(
    (id: string) => {
      if (!household) return;
      setDismissed((prev) => ({ ...prev, [household.id]: [...(prev[household.id] ?? []), id] }));
    },
    [household, setDismissed],
  );

  const retry = useCallback(() => {
    setState("idle");
    setAttempt((a) => a + 1);
  }, []);

  const ai = cached ?? null;
  return {
    ...computed,
    ai,
    loading: !!computed?.profile.sufficient && !cached && state !== "error",
    error: state === "error" && !cached,
    errorCode,
    recommendations: (ai?.recommendations ?? []).filter((r) => !dismissed.includes(r.id)),
    dismissedCount: dismissed.length,
    dismiss,
    retry,
  };
}
