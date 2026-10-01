"use client";
// Estados de UX: carga (spinner/skeleton), vacío, badges de estado.
import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

export function Spinner({ size = "md", label }: { size?: "sm" | "md" | "lg"; label?: string }) {
  const dims = { sm: "size-4 border-2", md: "size-6 border-[3px]", lg: "size-10 border-4" }[size];
  return (
    <span role={label ? "status" : undefined} className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cx("inline-block animate-spin rounded-full border-current border-t-transparent", dims)}
      />
      {label && <span className="text-sm text-on-surface-variant">{label}</span>}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx("animate-pulse rounded-xl bg-surface-high", className)} />;
}

/** Bloque de carga accesible (anuncia "Cargando…" a lectores de pantalla). */
export function LoadingBlock({ label, rows = 3 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-outline-variant bg-surface-low px-6 py-12 text-center">
      {icon && (
        <div aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-surface-container text-primary">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-bold text-on-surface">{title}</h2>
      {description && <p className="max-w-md text-on-surface-variant">{description}</p>}
      {action}
    </div>
  );
}

export type Tone = "success" | "warning" | "danger" | "neutral" | "info" | "primary";

const tones: Record<Tone, string> = {
  success: "bg-secondary-container text-on-secondary-container",
  warning: "bg-tertiary-fixed text-tertiary",
  danger: "bg-error-container text-on-error-container",
  neutral: "bg-surface-high text-on-surface-variant",
  info: "bg-primary-fixed text-primary",
  primary: "bg-primary text-on-primary",
};

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide uppercase",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ErrorAlert({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-error-container px-4 py-3 text-on-error-container">
      <p className="text-sm font-semibold">{children}</p>
      {action}
    </div>
  );
}

export function InfoNote({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "warning" }) {
  return (
    <p
      className={cx(
        "rounded-xl px-4 py-3 text-sm",
        tone === "info" ? "bg-primary-fixed/60 text-primary" : "bg-tertiary-fixed text-tertiary",
      )}
    >
      {children}
    </p>
  );
}
