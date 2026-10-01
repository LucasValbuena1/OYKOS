"use client";
// Felipe · F1 — HU01 Listar hogares, HU04 Eliminar hogar (desde el detalle).
// Diseño Figma "hogares": lista a la izquierda + vista detallada a la derecha.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Home, MapPin, Pencil, Plus, Trash2, BadgeCheck, Link2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useHouseholds, useInvoices, useServices } from "@/hooks/useDomain";
import { useHydrated } from "@/hooks/useStore";
import { useToast } from "@/components/ui/Toast";
import { PageHeader, Card } from "@/components/ui/Surface";
import { Button, IconButton, LinkButton } from "@/components/ui/Button";
import { Badge, EmptyState, LoadingBlock } from "@/components/ui/Feedback";
import { ConfirmDialog } from "@/components/ui/Modal";
import { ServiceIcon } from "@/components/common/ServiceIcon";
import { countServices } from "@/lib/domain/households";
import { lastInvoice } from "@/lib/domain/services";
import { cx } from "@/lib/utils";
import type { Household } from "@/types";

function HouseholdCard({ household, active, servicesCount }: { household: Household; active: boolean; servicesCount: number }) {
  const { dict, href, plural } = useI18n();
  return (
    <li>
      <Link
        href={href(`/hogares/${household.id}`)}
        aria-current={active ? "true" : undefined}
        className={cx(
          "flex flex-col gap-5 rounded-2xl border-l-8 p-6 shadow-sm transition hover:shadow-md",
          active ? "border-primary bg-surface-container" : "border-transparent bg-surface-low",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold break-words text-on-surface">{household.name}</h2>
            <p className="mt-1 flex items-center gap-1 text-on-surface-variant">
              <MapPin aria-hidden="true" className="size-4 shrink-0" />
              {household.address}
            </p>
            <p className="text-on-surface-variant">{household.city}</p>
          </div>
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <Home className="size-5" />
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{plural(dict.households.servicesCount, servicesCount)}</Badge>
          <Badge tone="neutral">{dict.propertyTypes[household.type]}</Badge>
        </div>
      </Link>
    </li>
  );
}

function HouseholdDetail({ household }: { household: Household }) {
  const { dict, href, t, money } = useI18n();
  const services = useServices();
  const invoices = useInvoices();
  const { removeHousehold } = useHouseholds();
  const router = useRouter();
  const { notify } = useToast();
  const [confirming, setConfirming] = useState(false);
  const linked = services.items.filter((s) => s.householdId === household.id);

  return (
    <Card tone="low" className="flex flex-col gap-8 rounded-3xl p-6 md:p-8" aria-labelledby="household-detail-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-widest text-primary uppercase">{dict.households.detail}</p>
          <h2 id="household-detail-title" className="text-3xl font-extrabold break-words md:text-5xl">
            {household.name}
          </h2>
          <p className="mt-2 flex items-center gap-2 text-lg text-on-surface-variant">
            <MapPin aria-hidden="true" className="size-5" />
            {household.address}, {household.city}
          </p>
          <p className="mt-1 text-on-surface-variant">
            {dict.propertyTypes[household.type]} · {t(dict.households.stratumValue, { value: household.stratum })}
          </p>
        </div>
        <div className="flex gap-2">
          <IconButton label={t(dict.households.editNamed, { name: household.name })} onClick={() => router.push(href(`/hogares/${household.id}/editar`))}>
            <Pencil aria-hidden="true" className="size-4" />
          </IconButton>
          <IconButton label={t(dict.households.deleteNamed, { name: household.name })} onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden="true" className="size-4" />
          </IconButton>
        </div>
      </div>

      <p className="inline-flex w-fit items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm font-semibold shadow-sm">
        <BadgeCheck aria-hidden="true" className="size-4 text-primary" /> {dict.households.verified}
      </p>

      <section aria-labelledby="linked-services" className="flex flex-col gap-6">
        <h3 id="linked-services" className="text-2xl font-bold">
          {dict.households.linkedServices}
        </h3>
        {linked.length === 0 ? (
          <p className="text-on-surface-variant">{dict.households.noServices}</p>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {linked.map((s) => {
              const last = lastInvoice(s.id, invoices.items);
              return (
                <li key={s.id}>
                  <Link href={href(`/servicios/${s.id}`)} className="flex h-full flex-col gap-4 rounded-2xl bg-white p-6 shadow-sm hover:shadow-md">
                    <div className="flex items-center justify-between gap-2">
                      <ServiceIcon type={s.type} />
                      <span className="truncate rounded-md bg-surface-high px-2 py-0.5 text-xs font-semibold text-on-surface-variant">{s.provider}</span>
                    </div>
                    <div>
                      <p className="text-xl font-bold">{dict.serviceTypes[s.type]}</p>
                      <p className="text-on-surface-variant">
                        {dict.services.contract} {s.accountNumber}
                      </p>
                    </div>
                    <div className="mt-auto flex items-center justify-between border-t border-outline-variant pt-3 text-sm">
                      <span className="font-semibold text-primary">{dict.common.active}</span>
                      <span className="font-bold">{last ? money(last.amount) : "—"}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <LinkButton href={`${href("/servicios/nuevo")}?hogar=${household.id}`} variant="tonal" className="w-fit" icon={<Link2 aria-hidden="true" className="size-4" />}>
          {dict.households.linkService}
        </LinkButton>
      </section>

      <ConfirmDialog
        open={confirming}
        title={t(dict.households.confirmDeleteTitle, { name: household.name })}
        message={dict.households.confirmDeleteMessage}
        confirmLabel={dict.common.delete}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          removeHousehold(household.id);
          setConfirming(false);
          notify(t(dict.households.deleted, { name: household.name }));
          router.push(href("/hogares"));
        }}
      />
    </Card>
  );
}

export function HouseholdsView({ selectedId }: { selectedId?: string }) {
  const { dict, href, plural } = useI18n();
  const households = useHouseholds();
  const services = useServices();
  const hydrated = useHydrated();
  const selected = households.items.find((h) => h.id === selectedId) ?? (selectedId ? undefined : households.items[0]);

  return (
    <>
      <PageHeader
        title={dict.households.title}
        subtitle={dict.households.subtitle}
        actions={
          <LinkButton href={href("/hogares/nuevo")} size="lg" icon={<Plus aria-hidden="true" className="size-4" />} className="uppercase tracking-wider">
            {dict.households.create}
          </LinkButton>
        }
      />
      {!hydrated ? (
        <LoadingBlock label={dict.common.loading} />
      ) : households.items.length === 0 ? (
        <EmptyState
          icon={<Home className="size-8" />}
          title={dict.households.emptyTitle}
          description={dict.households.emptyDescription}
          action={<LinkButton href={href("/hogares/nuevo")}>{dict.households.createFirst}</LinkButton>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <section aria-labelledby="households-list" className="flex flex-col gap-4">
            <h2 id="households-list" className="text-sm font-bold tracking-widest text-on-surface-variant uppercase" aria-live="polite">
              {plural(dict.households.counter, households.items.length)}
            </h2>
            <ul className="flex flex-col gap-4">
              {households.items.map((h) => (
                <HouseholdCard key={h.id} household={h} active={h.id === selected?.id} servicesCount={countServices(h.id, services.items)} />
              ))}
            </ul>
            <Link
              href={href("/hogares/nuevo")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-outline-variant bg-surface-low p-6 text-sm font-bold tracking-wider text-on-surface-variant uppercase hover:bg-surface-container"
            >
              <Plus aria-hidden="true" className="size-5" /> {dict.households.addProperty}
            </Link>
          </section>
          {selected ? (
            <HouseholdDetail household={selected} />
          ) : (
            <EmptyState title={dict.households.notFound} action={<Button onClick={() => history.back()}>{dict.common.back}</Button>} />
          )}
        </div>
      )}
    </>
  );
}
