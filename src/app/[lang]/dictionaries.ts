// Carga asíncrona de diccionarios (modelos de datos de traducción) para
// Server Components. Patrón de la guía oficial de Next.js:
// "Sharing the locale across your app" con next/root-params.
// Cada idioma es un import() dinámico: solo se descarga el JSON que se usa
// y nunca llega al bundle del cliente completo.
import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import type { Dictionary } from "@/i18n/types";

const dictionaries = {
  es: () => import("./dictionaries/es.json").then((module) => module.default as Dictionary),
  en: () => import("./dictionaries/en.json").then((module) => module.default as Dictionary),
};

export type DictionaryLocale = keyof typeof dictionaries;

export const hasLocale = (locale: string): locale is DictionaryLocale => locale in dictionaries;

/** Lee el segmento [lang] de la URL actual y devuelve su diccionario. */
export const getDictionary = async (): Promise<Dictionary> => {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return dictionaries[locale]();
};

/** Variante explícita (útil en generateMetadata o utilidades). */
export const getDictionaryFor = async (locale: string): Promise<Dictionary> => {
  if (!hasLocale(locale)) notFound();
  return dictionaries[locale]();
};
