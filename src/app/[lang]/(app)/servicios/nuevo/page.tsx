import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { ServiceForm } from "@/components/services/ServiceForm";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.serviceNew };
}

export default function Page() {
  return <ServiceForm />;
}
