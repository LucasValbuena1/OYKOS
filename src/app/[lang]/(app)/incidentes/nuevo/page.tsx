import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { IncidentForm } from "@/components/incidents/IncidentForm";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.incidentNew };
}

export default function Page() {
  return <IncidentForm />;
}
