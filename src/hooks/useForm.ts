"use client";
// useForm — maneja valores, errores y "touched" de cualquier formulario.
// Valida al perder el foco (onBlur) y al enviar, como se vio en clase
// (feedback inmediato pero no agresivo).
import { useCallback, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import type { FormErrors } from "@/lib/validation";

type FieldElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface UseFormOptions<T> {
  initialValues: T;
  validate: (values: T) => FormErrors<T>;
  onSubmit: (values: T) => void | Promise<void>;
}

export function useForm<T extends object>({ initialValues, validate, onSubmit }: UseFormOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const allErrors = useMemo(() => validate(values), [validate, values]);

  /** Solo se muestran errores de campos tocados o después de intentar enviar. */
  const errors = useMemo(() => {
    const visible: FormErrors<T> = {};
    for (const key of Object.keys(allErrors) as (keyof T)[]) {
      if (submitted || touched[key]) visible[key] = allErrors[key];
    }
    return visible;
  }, [allErrors, touched, submitted]);

  const setField = useCallback(<K extends keyof T>(name: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleChange = useCallback((e: ChangeEvent<FieldElement>) => {
    const { name, value, type } = e.target;
    const parsed = type === "number" ? (value === "" ? ("" as unknown) : Number(value)) : value;
    setValues((prev) => ({ ...prev, [name]: parsed }));
  }, []);

  const handleBlur = useCallback((e: { target: { name: string } }) => {
    setTouched((prev) => ({ ...prev, [e.target.name]: true }));
  }, []);

  const handleSubmit = useCallback(
    async (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      const formEl = e?.currentTarget;
      setSubmitted(true);
      const current = validate(values);
      if (Object.values(current).some(Boolean)) {
        // a11y: lleva el foco al primer campo con error
        const firstKey = Object.keys(current).find((k) => current[k as keyof T]);
        const el = formEl?.querySelector<HTMLElement>(`[name="${String(firstKey)}"]`);
        el?.focus();
        return false;
      }
      setSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setSubmitting(false);
      }
      return true;
    },
    [validate, values, onSubmit],
  );

  const reset = useCallback((next?: T) => {
    setValues(next ?? initialValues);
    setTouched({});
    setSubmitted(false);
  }, [initialValues]);

  const isValid = !Object.values(allErrors).some(Boolean);

  /** Props listas para un campo: value, name, onChange, onBlur, error. */
  const field = useCallback(
    (name: keyof T) => ({
      name: name as string,
      value: (values[name] === 0 ? "" : (values[name] ?? "")) as string | number,
      onChange: handleChange,
      onBlur: handleBlur,
      error: errors[name],
    }),
    [values, handleChange, handleBlur, errors],
  );

  return { values, errors, allErrors, isValid, submitting, submitted, setField, setValues, handleChange, handleBlur, handleSubmit, reset, field };
}
