import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { IncidentsView } from "@/components/incidents/IncidentsView";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.incidents };
}

export default function Page() {
  return <IncidentsView />;
}
