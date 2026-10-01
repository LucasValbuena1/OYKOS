// Idiomas soportados por Oykos. Para agregar uno: súmalo aquí y crea
// src/app/[lang]/dictionaries/xx.json (y su entrada en dictionaries.ts).
export const locales = ["es", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "es";

export const isLocale = (value: string | undefined | null): value is Locale =>
  !!value && (locales as readonly string[]).includes(value);

/** Locale BCP-47 usado por Intl para fechas y moneda. */
export const intlLocale: Record<Locale, string> = {
  es: "es-CO",
  en: "en-US",
};

/** Cookie que guarda la preferencia manual del usuario (LanguageSwitcher). */
export const LOCALE_COOKIE = "oykos-locale";
