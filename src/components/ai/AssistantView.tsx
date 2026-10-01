"use client";
// Alejandro · F2 — Asistente IA: HU06 predicción, HU07 perfil, HU08
// recomendaciones (descartables) y HU09 score de sostenibilidad.
import { Sparkles, TrendingUp, Gauge, Lightbulb, X, RefreshCw, Info } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useSelectedHousehold } from "@/hooks/useDomain";
import { useAssistant } from "@/hooks/useAssistant";
import { PageHeader, Card, BarChart } from "@/components/ui/Surface";
import { Badge, InfoNote, Skeleton, EmptyState } from "@/components/ui/Feedback";
import { Button, IconButton } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { ServiceIcon } from "@/components/common/ServiceIcon";
import { MIN_PROJECTION_HISTORY } from "@/lib/domain/dashboard";
import { SCORE_RANGES } from "@/lib/domain/assistant";
import { SERVICE_UNITS } from "@/lib/domain/services";
import { cx } from "@/lib/utils";

/** Indica que el texto lo generó Claude (solo cuando hay respuesta de la IA). */
function ClaudeBadge({ show }: { show: boolean }) {
  const { dict } = useI18n();
  if (!show) return null;
  return (
    <Badge tone="primary">
      <Sparkles aria-hidden="true" className="size-3" /> {dict.ai.poweredBy}
    </Badge>
  );
}

function AiSkeleton({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3" data-testid="ai-skeleton">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cx("h-4", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function AssistantView() {
  const { dict, locale, money, number, t, period, percent } = useI18n();
  const { households, selected, setSelectedId } = useSelectedHousehold();
  const a = useAssistant(selected, locale);
  const d = dict.assistant;

  if (!selected || !a.profile) {
    return (
      <>
        <PageHeader eyebrow={dict.ai.eyebrow} title={d.title} subtitle={d.subtitle} />
        <EmptyState title={dict.households.emptyTitle} />
      </>
    );
  }

  const insufficient = !a.profile.sufficient;

  return (
    <>
      <PageHeader
        eyebrow={dict.ai.eyebrow}
        title={d.title}
        subtitle={d.subtitle}
        actions={
          households.length > 1 ? (
            <SelectField label={dict.dashboard.household} value={selected.id} onChange={(e) => setSelectedId(e.target.value)} className="w-64">
              {households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </SelectField>
          ) : undefined
        }
      />

      {insufficient && (
        <InfoNote tone="warning">{t(d.insufficient, { months: a.profile.monthsUsed, needed: MIN_PROJECTION_HISTORY })}</InfoNote>
      )}
      {a.error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
          <p className="text-sm font-semibold">{(dict.ai.errors as Record<string, string>)[a.errorCode ?? ""] ?? dict.ai.errors.aiUnavailable}</p>
          <Button size="sm" variant="danger" icon={<RefreshCw aria-hidden="true" className="size-4" />} onClick={a.retry}>
            {dict.common.retry}
          </Button>
        </div>
      )}

      {/* HU06 · Predicción */}
      <Card aria-labelledby="pred-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="pred-title" className="flex items-center gap-2 text-xl font-bold">
            <TrendingUp aria-hidden="true" className="size-5 text-primary" /> {d.prediction.title}
          </h2>
          <Badge tone="warning">{dict.dashboard.projection.estimateBadge}</Badge>
        </div>
        <p className="text-sm text-on-surface-variant">{d.prediction.disclaimer}</p>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {a.predictions!.map((p) => (
            <li key={p.serviceId} className="flex flex-col gap-2 rounded-2xl bg-surface-low p-5" data-testid="ai-prediction">
              <span className="flex items-center gap-2 font-bold">
                <ServiceIcon type={p.serviceType} size="sm" /> {dict.serviceTypes[p.serviceType]}
              </span>
              {p.sufficient ? (
                <>
                  <p className="text-2xl font-extrabold">≈ {money(p.estimate)}</p>
                  <p className="text-on-surface-variant">
                    {t(d.prediction.consumption, { value: number(p.estimatedConsumption, 1), unit: SERVICE_UNITS[p.serviceType] })}
                  </p>
                  <p className="text-xs text-on-surface-variant">{t(d.prediction.basedOn, { months: p.monthsUsed })}</p>
                </>
              ) : (
                <p className="text-sm text-on-surface-variant">{t(d.prediction.needMore, { months: p.monthsUsed, needed: MIN_PROJECTION_HISTORY })}</p>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        {/* HU07 · Perfil */}
        <Card aria-labelledby="profile-title" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="profile-title" className="flex items-center gap-2 text-xl font-bold">
              <Gauge aria-hidden="true" className="size-5 text-primary" /> {d.profile.title}
            </h2>
            <ClaudeBadge show={!!a.ai && a.recommendations.length + a.dismissedCount > 0} />
          </div>
          {insufficient ? (
            <p className="text-on-surface-variant">{d.profile.insufficient}</p>
          ) : (
            <>
              <p className="flex items-baseline gap-3">
                <span
                  className={cx(
                    "rounded-full px-4 py-1 text-lg font-extrabold uppercase",
                    a.profile.level === "alto" ? "bg-error-container text-on-error-container" : a.profile.level === "bajo" ? "bg-secondary-container text-on-secondary-container" : "bg-tertiary-fixed text-tertiary",
                  )}
                  data-testid="profile-level"
                >
                  {d.profile.levels[a.profile.level!]}
                </span>
                <span className="text-on-surface-variant">
                  {t(d.profile.vsReference, { avg: money(a.profile.averageMonthly), ref: money(a.profile.reference), stratum: selected.stratum })}
                </span>
              </p>
              {a.loading ? (
                <AiSkeleton label={d.loading} />
              ) : (
                <p className="text-on-surface" data-testid="profile-explanation">
                  {a.ai?.profileExplanation ?? t(d.profile.basis, { ratio: percent((a.profile.ratio - 1) * 100) })}
                </p>
              )}
              <div>
                <h3 className="mb-2 text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{d.profile.patterns}</h3>
                <ul className="flex flex-col gap-1 text-on-surface-variant">
                  {a.profile.peakPeriods.length > 0 && (
                    <li>• {t(d.profile.peaks, { months: a.profile.peakPeriods.map((p) => period(p)).join(", ") })}</li>
                  )}
                  {a.profile.heaviestService && (
                    <li>• {t(d.profile.heaviest, { service: dict.serviceTypes[a.profile.heaviestService.type], share: a.profile.heaviestService.share })}</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </Card>

        {/* HU09 · Score */}
        <Card aria-labelledby="score-title" className="flex flex-col gap-5">
          <h2 id="score-title" className="flex items-center gap-2 text-xl font-bold">
            <Sparkles aria-hidden="true" className="size-5 text-primary" /> {d.score.title}
          </h2>
          {!a.score ? (
            <p className="text-on-surface-variant">{d.score.insufficient}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-6">
                <p className="flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold text-primary" data-testid="score-value">
                    {a.score.value}
                  </span>
                  <span className="text-on-surface-variant">/100</span>
                </p>
                <Badge tone={a.scoreRange === "alto" ? "success" : a.scoreRange === "medio" ? "warning" : "danger"}>{d.score.ranges[a.scoreRange!]}</Badge>
              </div>
              <ul aria-label={d.score.scale} className="grid grid-cols-3 gap-2 text-xs">
                {SCORE_RANGES.map((r) => (
                  <li key={r.key} className={cx("rounded-lg p-2", r.key === a.scoreRange ? "bg-primary text-white" : "bg-surface-low text-on-surface-variant")}>
                    <span className="block font-bold">
                      {r.min}–{r.max}
                    </span>
                    {d.score.meaning[r.key]}
                  </li>
                ))}
              </ul>
              <div>
                <h3 className="mb-2 flex items-center gap-1 text-sm font-semibold tracking-wider text-on-surface-variant uppercase">
                  <Info aria-hidden="true" className="size-4" /> {d.score.how}
                </h3>
                <p className="mb-3 text-sm text-on-surface-variant">{d.score.formula}</p>
                <ul className="flex flex-col gap-2">
                  {a.score.breakdown.map((b) => (
                    <li key={b.serviceType} className="flex items-center justify-between gap-3 rounded-lg bg-surface-low px-3 py-2 text-sm">
                      <span className="flex items-center gap-2 font-semibold">
                        <ServiceIcon type={b.serviceType} size="sm" /> {dict.serviceTypes[b.serviceType]}
                      </span>
                      <span>
                        {t(d.score.weight, { weight: Math.round(b.weight * 100) })} · {b.subScore}/100 ·{" "}
                        {t(d.score.vsRef, { value: number(b.consumption, 1), ref: b.reference, unit: SERVICE_UNITS[b.serviceType] })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {a.loading ? <AiSkeleton label={d.loading} lines={2} /> : a.ai?.scoreExplanation && <p data-testid="score-explanation">{a.ai.scoreExplanation}</p>}
              {a.history!.length > 1 && (
                <BarChart title={d.score.evolution} data={a.history!.map((h) => ({ label: period(h.period, true), value: h.value }))} formatValue={(v) => String(v)} height={160} />
              )}
            </>
          )}
        </Card>
      </div>

      {/* HU08 · Recomendaciones */}
      <Card aria-labelledby="recs-title" className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="recs-title" className="flex items-center gap-2 text-xl font-bold">
            <Lightbulb aria-hidden="true" className="size-5 text-primary" /> {d.recommendations.title}
          </h2>
          <ClaudeBadge show={!!a.ai && a.recommendations.length + a.dismissedCount > 0} />
        </div>
        {insufficient ? (
          <p className="text-on-surface-variant">{d.profile.insufficient}</p>
        ) : a.loading ? (
          <AiSkeleton label={d.loading} lines={5} />
        ) : a.recommendations.length === 0 ? (
          <p className="text-on-surface-variant">{a.dismissedCount ? d.recommendations.allDismissed : d.recommendations.none}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {a.recommendations.map(({ title, reason, ...r }) => {
              return (
                <li key={r.id} className="relative flex flex-col gap-3 rounded-2xl bg-surface-low p-5 pr-12" data-testid="ai-recommendation">
                  <IconButton label={t(d.recommendations.dismiss, { title })} variant="ghost" className="absolute top-3 right-3" onClick={() => a.dismiss(r.id)}>
                    <X aria-hidden="true" className="size-4" />
                  </IconButton>
                  <span className="flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                    <ServiceIcon type={r.serviceType} size="sm" /> {dict.serviceTypes[r.serviceType]}
                  </span>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="text-on-surface-variant">{reason}</p>
                  <p className="font-bold text-secondary">{t(d.recommendations.saving, { amount: money(r.estimatedSaving) })}</p>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
