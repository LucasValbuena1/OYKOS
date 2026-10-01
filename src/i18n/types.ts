// El tipo del diccionario se deriva del JSON en español: si falta una clave en
// otro idioma o en un componente, TypeScript lo marca en compilación.
import type es from "@/app/[lang]/dictionaries/es.json";

export type Dictionary = typeof es;
