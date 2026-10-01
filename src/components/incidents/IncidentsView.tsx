"use client";
// Lucas · F2 — HU05 Listar incidentes (abiertos primero, filtros),
// HU07 actualizar estado/bitácora, HU08 cerrar/eliminar. Figma "incidentes".
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertOctagon, CheckCircle2, ClipboardList, Hourglass, Paperclip, Plus, Search, Trash2, MapPin, Hash } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useIncidents, useServices, useSelectedHousehold } from "@/hooks/useDomain";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/ui/Surface";
import { Button, LinkButton } from "@/components/ui/Button";
import { Badge, EmptyState, type Tone } from "@/components/ui/Feedback";
import { SelectField, TextAreaField, TextField } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import {
  chronologicalLog,
  countByStatus,
  defaultIncidentFilters,
  EDITABLE_STATUSES,
  filterIncidents,
  type IncidentFilters,
} from "@/lib/domain/incidents";
import { cx, toISODate } from "@/lib/utils";
import type { Incident, IncidentStatus } from "@/types";

export const STATUS_TONE: Record<IncidentStatus, Tone> = { abierto: "danger", en_gestion: "warning", resuelto: "info", cerrado: "success" };
const BAR: Record<IncidentStatus, string> = { abierto: "bg-error", en_gestion: "bg-tertiary", resuelto: "bg-primary-container", cerrado: "bg-primary" };

function useRelative() {
  const { dict, dateTime, t } = useI18n();
  return (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return dict.common.today;
    if (days === 1) return dict.common.yesterday;
    if (days < 7) return t(dict.common.daysAgo, { days });
    return dateTime(iso);
  };
}

function IncidentDetailPanel({ incident }: { incident: Incident }) {
  const { dict, dateTime, date, t, href } = useI18n();
  const incidents = useIncidents();
  const services = useServices();
  const { households } = useSelectedHousehold();
  const router = useRouter();
  const { notify } = useToast();
  const svc = services.getById(incident.serviceId);
  const [status, setStatus] = useState<IncidentStatus>(incident.status === "cerrado" ? "resuelto" : incident.status);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [description, setDescription] = useState(incident.description);
  const [filing, setFiling] = useState(incident.filingNumber ?? "");
  const [closing, setClosing] = useState(false);
  const [solvedAt, setSolvedAt] = useState(toISODate(new Date()));
  const [closeComment, setCloseComment] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const closed = incident.status === "cerrado";

  return (
    <section aria-labelledby="incident-title" className="flex flex-col gap-8 rounded-3xl bg-white p-6 shadow-sm md:p-8">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge tone={STATUS_TONE[incident.status]}>{dict.incidentStatus[incident.status]}</Badge>
          <span className="font-bold text-on-surface-variant">#{incident.code}</span>
        </div>
        <h2 id="incident-title" className="text-2xl font-bold">
          {dict.incidentTypes[incident.type]} · {svc ? dict.serviceTypes[svc.type] : dict.notifications.deletedService}
        </h2>
        <div className="flex flex-wrap gap-4 text-sm text-on-surface-variant">
          <span className="flex items-center gap-1">
            <MapPin aria-hidden="true" className="size-4" /> {households.find((h) => h.id === svc?.householdId)?.name ?? "—"}
          </span>
          <span className="flex items-center gap-1">
            <Hash aria-hidden="true" className="size-4" /> {incident.filingNumber ? t(dict.incidents.filing, { number: incident.filingNumber }) : dict.incidents.noFiling}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant">{t(dict.incidents.startedAt, { date: dateTime(incident.startedAt) })}</p>
      </header>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.incidents.description}</h3>
        {editing ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (description.trim().length < 10) return;
              incidents.update(incident.id, { description: description.trim(), filingNumber: filing.trim() || undefined });
              setEditing(false);
              notify(dict.incidents.updated);
            }}
          >
            <TextAreaField label={dict.incidents.fields.description} value={description} onChange={(e) => setDescription(e.target.value)} error={description.trim().length < 10 ? "minLength" : undefined} />
            <TextField label={dict.incidents.fields.filingNumber} value={filing} onChange={(e) => setFiling(e.target.value)} />
            <div className="flex gap-2">
              <Button variant="tonal" onClick={() => setEditing(false)}>
                {dict.common.cancel}
              </Button>
              <Button type="submit">{dict.common.save}</Button>
            </div>
          </form>
        ) : (
          <>
            <p className="rounded-xl bg-surface-low p-4 whitespace-pre-line">{incident.description}</p>
            {!closed && (
              <Button variant="ghost" size="sm" className="w-fit" onClick={() => setEditing(true)}>
                {dict.incidents.editDescription}
              </Button>
            )}
          </>
        )}
        {incident.evidence && (
          <a href={incident.evidence.dataUrl} download={incident.evidence.name} className="inline-flex items-center gap-2 font-semibold text-primary underline">
            <Paperclip aria-hidden="true" className="size-4" /> {incident.evidence.name}
          </a>
        )}
      </div>

      {!closed && (
        <form
          aria-labelledby="status-form"
          className="flex flex-col gap-4 rounded-2xl bg-surface-container p-5"
          onSubmit={(e) => {
            e.preventDefault();
            incidents.changeStatus(incident.id, status, comment);
            setComment("");
            notify(t(dict.incidents.statusChanged, { status: dict.incidentStatus[status] }));
          }}
        >
          <h3 id="status-form" className="font-bold">
            {dict.incidents.updateStatus}
          </h3>
          <SelectField label={dict.incidents.fields.status} value={status} onChange={(e) => setStatus(e.target.value as IncidentStatus)}>
            {EDITABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {dict.incidentStatus[s]}
              </option>
            ))}
          </SelectField>
          <TextAreaField label={dict.incidents.fields.comment} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={dict.incidents.commentPlaceholder} />
          <Button type="submit">{dict.incidents.saveStatus}</Button>
        </form>
      )}

      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{dict.incidents.timeline}</h3>
        <ol className="relative flex flex-col gap-6 border-l-2 border-outline-variant pl-6">
          {chronologicalLog(incident).map((entry, i) => (
            <li key={`${entry.date}-${i}`} className="relative">
              <span aria-hidden="true" className={cx("absolute top-1 -left-[33px] size-4 rounded-full border-4 border-white", BAR[entry.status])} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{dict.incidentStatus[entry.status]}</p>
                <time dateTime={entry.date} className="text-sm text-on-surface-variant">
                  {dateTime(entry.date)}
                </time>
              </div>
              {entry.comment && <p className="text-sm text-on-surface-variant">{entry.comment}</p>}
            </li>
          ))}
        </ol>
        {incident.closedAt && <p className="text-sm font-semibold text-primary">{t(dict.incidents.solvedOn, { date: date(incident.closedAt) })}</p>}
      </div>

      <div className="flex flex-wrap gap-3 border-t border-surface-high pt-6">
        {!closed && (
          <Button variant="secondary" icon={<CheckCircle2 aria-hidden="true" className="size-4" />} onClick={() => setClosing((v) => !v)} aria-expanded={closing}>
            {dict.incidents.close}
          </Button>
        )}
        <Button variant="outline" icon={<Trash2 aria-hidden="true" className="size-4" />} onClick={() => setConfirmDelete(true)}>
          {dict.incidents.delete}
        </Button>
      </div>
      {closing && !closed && (
        <form
          className="flex flex-col gap-4 rounded-2xl bg-surface-low p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!solvedAt || !closeComment.trim()) return;
            incidents.close(incident.id, solvedAt, closeComment);
            setClosing(false);
            notify(dict.incidents.closed);
          }}
        >
          <TextField label={dict.incidents.fields.solvedAt} type="date" value={solvedAt} max={toISODate(new Date())} onChange={(e) => setSolvedAt(e.target.value)} required />
          <TextAreaField label={dict.incidents.fields.closingComment} value={closeComment} onChange={(e) => setCloseComment(e.target.value)} required error={!closeComment.trim() ? "required" : undefined} />
          <Button type="submit" disabled={!closeComment.trim()}>
            {dict.incidents.confirmClose}
          </Button>
        </form>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={t(dict.incidents.confirmDeleteTitle, { code: incident.code })}
        message={dict.incidents.confirmDeleteMessage}
        confirmLabel={dict.common.delete}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          incidents.remove(incident.id);
          setConfirmDelete(false);
          notify(dict.incidents.deleted);
          router.push(href("/incidentes"));
        }}
      />
    </section>
  );
}

export function IncidentsView({ selectedId }: { selectedId?: string }) {
  const { dict, href, plural } = useI18n();
  const incidents = useIncidents();
  const services = useServices();
  const relative = useRelative();
  const [filters, setFilters] = useState<IncidentFilters>(defaultIncidentFilters);
  const list = useMemo(() => filterIncidents(incidents.items, filters), [incidents.items, filters]);
  const counts = countByStatus(incidents.items);
  const selected = incidents.getById(selectedId);

  const stats: { key: IncidentStatus; label: string; icon: typeof AlertOctagon; tone: string }[] = [
    { key: "abierto", label: dict.incidentStatus.abierto, icon: AlertOctagon, tone: "bg-error-container text-on-error-container" },
    { key: "en_gestion", label: dict.incidentStatus.en_gestion, icon: Hourglass, tone: "bg-tertiary-fixed text-tertiary" },
    { key: "cerrado", label: dict.incidentStatus.cerrado, icon: CheckCircle2, tone: "bg-primary-fixed text-primary" },
  ];

  return (
    <>
      <PageHeader
        eyebrow={dict.incidents.eyebrow}
        title={dict.incidents.title}
        subtitle={dict.incidents.subtitle}
        actions={
          <LinkButton href={href("/incidentes/nuevo")} size="lg" icon={<Plus aria-hidden="true" className="size-4" />}>
            {dict.incidents.report}
          </LinkButton>
        }
      />
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <ul aria-label={dict.incidents.stats} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {stats.map((s) => (
              <li key={s.key} className="relative overflow-hidden rounded-2xl bg-surface-container p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold tracking-wider text-on-surface-variant uppercase">{s.label}</p>
                    <p className="text-3xl font-extrabold">{counts[s.key]}</p>
                  </div>
                  <span aria-hidden="true" className={cx("flex size-10 items-center justify-center rounded-full", s.tone)}>
                    <s.icon className="size-5" />
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <section aria-labelledby="incidents-list" className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="incidents-list" className="text-xl font-bold">
                {dict.incidents.recent}
              </h2>
              <span aria-live="polite" className="text-sm text-on-surface-variant">
                {plural(dict.incidents.counter, list.length)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SelectField label={dict.incidents.fields.status} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as IncidentFilters["status"] }))}>
                <option value="all">{dict.common.all}</option>
                {(["abierto", "en_gestion", "resuelto", "cerrado"] as IncidentStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {dict.incidentStatus[s]}
                  </option>
                ))}
              </SelectField>
              <SelectField label={dict.incidents.fields.service} value={filters.serviceId} onChange={(e) => setFilters((f) => ({ ...f, serviceId: e.target.value }))}>
                <option value="all">{dict.common.all}</option>
                {services.items.map((s) => (
                  <option key={s.id} value={s.id}>
                    {dict.serviceTypes[s.type]} · {s.provider}
                  </option>
                ))}
              </SelectField>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-4 accent-primary" checked={filters.showClosed} onChange={(e) => setFilters((f) => ({ ...f, showClosed: e.target.checked }))} />
              {dict.incidents.showClosed}
            </label>
            {incidents.items.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="size-8" />}
                title={dict.incidents.emptyTitle}
                description={dict.incidents.emptyDescription}
                action={<LinkButton href={href("/incidentes/nuevo")}>{dict.incidents.report}</LinkButton>}
              />
            ) : list.length === 0 ? (
              <p className="text-on-surface-variant">{dict.incidents.noResults}</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {list.map((inc) => {
                  const svc = services.getById(inc.serviceId);
                  const active = inc.id === selectedId;
                  return (
                    <li key={inc.id} data-status={inc.status}>
                      <Link
                        href={href(`/incidentes/${inc.id}`)}
                        aria-current={active ? "true" : undefined}
                        className={cx(
                          "relative flex items-start justify-between gap-4 overflow-hidden rounded-xl p-5 pl-7 transition hover:shadow",
                          inc.status === "abierto" ? "bg-surface-low ring-1 ring-error/30" : "bg-surface",
                          active && "ring-2 ring-primary",
                        )}
                      >
                        <span aria-hidden="true" className={cx("absolute inset-y-0 left-0 w-1.5", BAR[inc.status])} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={STATUS_TONE[inc.status]}>{dict.incidentStatus[inc.status]}</Badge>
                            <span className="text-sm text-on-surface-variant">#{inc.code}</span>
                          </div>
                          <h3 className="mt-1 text-lg font-bold">
                            {dict.incidentTypes[inc.type]} · {svc ? `${dict.serviceTypes[svc.type]} (${svc.provider})` : "—"}
                          </h3>
                          <p className="truncate text-on-surface-variant">{inc.description}</p>
                        </div>
                        <span className="shrink-0 text-sm text-on-surface-variant">{relative(inc.createdAt)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
        <div>
          {selected ? (
            <IncidentDetailPanel key={selected.id + selected.status} incident={selected} />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-10 text-center shadow-sm">
              <span aria-hidden="true" className="flex size-28 items-center justify-center rounded-full bg-surface-container">
                <Search className="size-10 text-primary" />
              </span>
              <h2 className="text-2xl font-bold">{selectedId ? dict.incidents.notFound : dict.incidents.selectTitle}</h2>
              <p className="text-on-surface-variant">{dict.incidents.selectDescription}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
