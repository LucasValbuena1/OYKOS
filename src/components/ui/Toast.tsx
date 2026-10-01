"use client";
// Notificaciones efímeras ("toasts"). Se anuncian con aria-live para que los
// lectores de pantalla informen las confirmaciones de éxito.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { cx } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const { dict } = useI18n();

  const dismiss = useCallback((id: number) => setItems((prev) => prev.filter((t) => t.id !== id)), []);

  const notify = useCallback(
    (message: string, tone: ToastTone = "success") => {
      const id = ++counter.current;
      setItems((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cx(
              "pointer-events-auto flex items-start gap-3 rounded-2xl p-4 shadow-xl",
              t.tone === "error" ? "bg-error-container text-on-error-container" : "bg-surface-highest text-on-surface",
            )}
          >
            {t.tone === "error" ? (
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            ) : (
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
            )}
            <p className="flex-1 text-sm font-semibold">{t.message}</p>
            <button type="button" onClick={() => dismiss(t.id)} aria-label={dict.common.close} className="rounded-full p-1 hover:bg-white/50">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
