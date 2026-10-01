"use client";
// Campos de formulario accesibles: label asociado, aria-invalid,
// aria-describedby apuntando al mensaje de error / ayuda.
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/lib/utils";
import type { ValidationKey } from "@/lib/validation";
import { useI18n } from "@/i18n/I18nProvider";

const control =
  "w-full rounded-xl border border-outline-variant/70 bg-surface-low px-4 text-base text-on-surface placeholder:text-placeholder outline-none ring-primary-container transition focus:ring-2 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-error";

interface BaseProps {
  label: string;
  error?: ValidationKey | string;
  hint?: string;
  required?: boolean;
  className?: string;
  /** Mensaje de error ya traducido (tiene prioridad sobre error). */
  errorText?: string;
}

function useFieldMessages(error?: string, errorText?: string) {
  const { dict } = useI18n();
  if (errorText) return errorText;
  if (!error) return undefined;
  return (dict.validation as Record<string, string>)[error] ?? error;
}

function FieldShell({
  id,
  label,
  required,
  message,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  message?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-sm font-semibold tracking-wide text-on-surface-variant uppercase">
        {label}
        {required && (
          <span aria-hidden="true" className="text-error">
            {" "}*
          </span>
        )}
      </label>
      {children}
      {hint && !message && (
        <p id={`${id}-hint`} className="text-xs text-on-surface-variant">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="flex items-center gap-1 text-sm font-semibold text-error">
          <span aria-hidden="true">⚠</span> {message}
        </p>
      )}
    </div>
  );
}

function describedBy(id: string, message?: string, hint?: string) {
  if (message) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

export function TextField({
  label,
  error,
  errorText,
  hint,
  required,
  className,
  prefix,
  ...input
}: BaseProps & Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & { prefix?: ReactNode }) {
  const id = useId();
  const message = useFieldMessages(error, errorText);
  return (
    <FieldShell id={id} label={label} required={required} message={message} hint={hint} className={className}>
      <div className="relative">
        {prefix && (
          <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-on-surface-variant">
            {prefix}
          </span>
        )}
        <input
          id={id}
          aria-invalid={message ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy(id, message, hint)}
          className={cx(control, "h-12", prefix ? "pl-10" : undefined)}
          {...input}
        />
      </div>
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  errorText,
  hint,
  required,
  className,
  children,
  ...select
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  const message = useFieldMessages(error, errorText);
  return (
    <FieldShell id={id} label={label} required={required} message={message} hint={hint} className={className}>
      <div className="relative">
        <select
          id={id}
          aria-invalid={message ? true : undefined}
          aria-required={required || undefined}
          aria-describedby={describedBy(id, message, hint)}
          className={cx(control, "h-12 appearance-none pr-10")}
          {...select}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-on-surface-variant"
        />
      </div>
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  error,
  errorText,
  hint,
  required,
  className,
  ...area
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  const message = useFieldMessages(error, errorText);
  return (
    <FieldShell id={id} label={label} required={required} message={message} hint={hint} className={className}>
      <textarea
        id={id}
        aria-invalid={message ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={describedBy(id, message, hint)}
        className={cx(control, "min-h-28 py-3")}
        {...area}
      />
    </FieldShell>
  );
}

/** Grupo de opciones tipo "segmented control" accesible (radiogroup). */
export function SegmentedControl<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  hideLabel,
}: {
  label: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  hideLabel?: boolean;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className={cx("mb-2 text-sm font-semibold tracking-wide text-on-surface-variant uppercase", hideLabel && "sr-only")}>
        {label}
      </legend>
      <div className="flex flex-wrap gap-2 rounded-xl bg-surface-container p-1">
        {options.map((opt) => {
          const checked = opt.value === value;
          return (
            <label
              key={opt.value}
              className={cx(
                "flex min-h-10 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-semibold transition has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary-container",
                checked ? "bg-primary text-on-primary shadow" : "text-on-surface-variant hover:bg-surface-high",
              )}
            >
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={opt.value}
                checked={checked}
                onChange={() => onChange(opt.value)}
              />
              {opt.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Interruptor accesible (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-primary" : "bg-surface-highest",
      )}
    >
      <span
        aria-hidden="true"
        className={cx(
          "inline-block size-5 rounded-full shadow transition-transform",
          checked ? "translate-x-6 bg-white" : "translate-x-1 bg-outline",
        )}
      />
    </button>
  );
}
