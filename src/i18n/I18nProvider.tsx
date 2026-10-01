"use client";
// El diccionario se carga en el servidor (layout → getDictionary) y se entrega
// una sola vez a este Provider para que los Client Components lo usen con
// useI18n() sin volver a descargarlo ni hacer prop drilling.
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Dictionary } from "./types";
import type { Locale } from "./config";
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  formatPercent,
  formatPeriod,
  interpolate,
  plural,
} from "@/lib/utils";

interface I18nContextValue {
  dict: Dictionary;
  locale: Locale;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ dict, locale, children }: I18nContextValue & { children: ReactNode }) {
  const value = useMemo(() => ({ dict, locale }), [dict, locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n debe usarse dentro de <I18nProvider>");
  const { dict, locale } = ctx;
  return useMemo(
    () => ({
      dict,
      locale,
      t: interpolate,
      plural,
      money: (v: number) => formatMoney(v, locale),
      number: (v: number, digits = 0) => formatNumber(v, locale, digits),
      percent: (v: number) => formatPercent(v, locale),
      date: (v: string, opts?: Intl.DateTimeFormatOptions) => formatDate(v, locale, opts),
      dateTime: (v: string) => formatDateTime(v, locale),
      period: (v: string, short = false) => formatPeriod(v, locale, short),
      /** Construye una ruta con el prefijo del idioma: href("/hogares") → "/es/hogares". */
      href: (path: string) => `/${locale}${path.startsWith("/") ? path : `/${path}`}`,
    }),
    [dict, locale],
  );
}
