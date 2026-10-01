"use client";
// Hooks de interfaz reutilizables.
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/** Abre/cierra modales, menús y paneles. */
export function useDisclosure(initial = false) {
  const [isOpen, setIsOpen] = useState(initial);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);
  return { isOpen, open, close, toggle };
}

/**
 * Ejecuta una tarea asíncrona exponiendo estado de carga y error.
 * Se usa para simular tiempos de respuesta (reportes, exportaciones).
 */
export function useAsyncTask<A extends unknown[], R>(task: (...args: A) => Promise<R> | R) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: A): Promise<R | undefined> => {
      setLoading(true);
      setError(null);
      try {
        const result = await task(...args);
        return result;
      } catch (e) {
        if (mounted.current) setError(e);
        return undefined;
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [task],
  );

  return { run, loading, error, reset: () => setError(null) };
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Focus trap para diálogos: mantiene el foco dentro del contenedor, cierra con
 * Escape y devuelve el foco al elemento que abrió el diálogo.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  useEffect(() => {
    if (!active || !ref.current) return;
    const container = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE));
    (focusables()[0] ?? container).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onEscape?.();
        return;
      }
      if (e.key !== "Tab") return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    container.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [active, ref, onEscape]);
}
