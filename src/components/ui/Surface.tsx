"use client";
// Contenedores y visualizaciones reutilizables del diseño de Oykos.
import type { ReactNode } from "react";
import { cx } from "@/lib/utils";

export function Card({
  children,
  className,
  tone = "white",
  as: Tag = "section",
  ...rest
}: {
  children: ReactNode;
  className?: string;
  tone?: "white" | "container" | "low" | "primary";
  as?: "section" | "div" | "article" | "aside" | "li";
} & Record<string, unknown>) {
  const tones = {
    white: "bg-white shadow-[0_1px_3px_rgba(19,30,27,0.06),0_8px_24px_rgba(19,30,27,0.04)]",
    container: "bg-surface-container",
    low: "bg-surface-low",
    primary: "bg-primary text-on-primary",
  };
  return (
    <Tag className={cx("rounded-3xl p-6", tones[tone], className)} {...rest}>
      {children}
    </Tag>
  );
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="flex max-w-2xl flex-col gap-2">
        {eyebrow && <p className="text-sm font-bold tracking-widest text-primary uppercase">{eyebrow}</p>}
        <h1 className="text-3xl font-extrabold text-on-surface md:text-5xl">{title}</h1>
        {subtitle && <p className="text-lg text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  caption,
  icon,
  tone = "white",
  badgeTone = "success",
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  icon?: ReactNode;
  tone?: "white" | "primary";
  badgeTone?: "success" | "danger" | "warning" | "primary";
}) {
  const iconTones = {
    success: "bg-secondary-container text-on-secondary-container",
    danger: "bg-error-container text-on-error-container",
    warning: "bg-tertiary-container text-on-tertiary-container",
    primary: "bg-primary-container text-on-primary-container",
  };
  const isPrimary = tone === "primary";
  return (
    <div
      className={cx(
        "relative flex flex-col gap-4 overflow-hidden rounded-2xl p-6",
        isPrimary ? "bg-primary text-on-primary" : "bg-white shadow-sm",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {icon && (
          <span aria-hidden="true" className={cx("flex size-10 items-center justify-center rounded-full", iconTones[badgeTone])}>
            {icon}
          </span>
        )}
        {caption && (
          <span className={cx("text-sm font-semibold", isPrimary ? "text-primary-fixed" : "text-secondary")}>{caption}</span>
        )}
      </div>
      <div>
        <p className={cx("text-3xl font-extrabold", isPrimary ? "text-white" : "text-on-surface")}>{value}</p>
        <p className={cx("text-base", isPrimary ? "text-primary-fixed-dim" : "text-on-surface-variant")}>{label}</p>
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  label,
  tone = "primary",
}: {
  value: number;
  label: string;
  tone?: "primary" | "warning" | "danger";
}) {
  const color = { primary: "bg-primary", warning: "bg-tertiary", danger: "bg-error" }[tone];
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-highest"
    >
      <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Gráfica de barras sin librerías. Accesible: se expone como figure con una
 * tabla oculta (sr-only) con los mismos datos para lectores de pantalla.
 */
export function BarChart({
  title,
  data,
  formatValue,
  highlightLast = true,
  height = 200,
  dark = false,
}: {
  title: string;
  data: { label: string; value: number; highlight?: boolean; dashed?: boolean }[];
  formatValue: (v: number) => string;
  highlightLast?: boolean;
  height?: number;
  dark?: boolean;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure aria-label={title} className="flex flex-col gap-3">
      <figcaption className="sr-only">{title}</figcaption>
      <div aria-hidden="true" className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const active = d.highlight ?? (highlightLast && i === data.length - 1);
          return (
            <div key={`${d.label}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
              <span
                className={cx(
                  "max-w-full truncate rounded px-1 py-0.5 text-[10px] font-bold whitespace-nowrap sm:px-1.5 sm:text-xs",
                  // En celular solo se muestra el valor destacado para no desbordar
                  !active && "hidden sm:block",
                  active ? "bg-primary-container text-on-primary-container" : "bg-surface-inverse text-on-surface-inverse",
                )}
              >
                {formatValue(d.value)}
              </span>
              <div
                className={cx(
                  "w-full max-w-14 rounded-t-lg transition-all",
                  d.dashed
                    ? "border-2 border-dashed border-primary bg-primary-fixed/50"
                    : active
                      ? "bg-primary"
                      : dark
                        ? "bg-primary-fixed"
                        : "bg-surface-high",
                )}
                style={{ height: `${Math.max(4, (d.value / max) * (height - 40))}px` }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="flex gap-2">
        {data.map((d, i) => (
          <span key={`${d.label}-l-${i}`} className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-on-surface-variant first-letter:uppercase sm:text-sm">
            {d.label}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-r-${i}`}>
              <th scope="row">{d.label}</th>
              <td>{formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
