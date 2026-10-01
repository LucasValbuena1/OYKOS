"use client";
// Carga de soportes (PDF / imagen) con validación de formato y tamaño.
import { useId, useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import type { Attachment } from "@/types";
import { useI18n } from "@/i18n/I18nProvider";
import { readFileAsDataUrl, validateFile, MAX_FILE_BYTES } from "@/lib/utils";

export function FileField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value?: Attachment;
  onChange: (file: Attachment | undefined) => void;
  hint?: string;
}) {
  const id = useId();
  const { dict, t } = useI18n();
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    setError(null);
    if (!file) return;
    const problem = validateFile(file);
    if (problem === "type") return setError(dict.files.invalidType);
    if (problem === "size") return setError(t(dict.files.tooLarge, { max: MAX_FILE_BYTES / 1024 / 1024 }));
    const dataUrl = await readFileAsDataUrl(file);
    onChange({ name: file.name, type: file.type, size: file.size, dataUrl });
  }

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-sm font-semibold tracking-wide text-on-surface-variant uppercase">
        {label}
      </span>
      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-high px-4 py-3">
          <a href={value.dataUrl} download={value.name} className="flex min-w-0 items-center gap-2 font-semibold text-primary underline">
            <Paperclip aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">{value.name}</span>
          </a>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded-full p-1 hover:bg-surface-highest"
            aria-label={t(dict.files.remove, { name: value.name })}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl bg-surface-high px-4 py-6 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-primary-container"
        >
          <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-white shadow">
            <Upload className="size-5 text-primary" />
          </span>
          <span className="text-sm font-semibold text-on-surface-variant">{dict.files.choose}</span>
          <span className="text-xs text-on-surface-variant">{hint ?? t(dict.files.hint, { max: MAX_FILE_BYTES / 1024 / 1024 })}</span>
          <input
            id={id}
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            aria-labelledby={`${id}-label`}
            aria-describedby={error ? `${id}-error` : undefined}
            className="sr-only"
            onChange={(e) => handle(e.target.files?.[0])}
          />
        </label>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </div>
  );
}
