import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { ServicesView } from "@/components/services/ServicesView";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.services };
}

export default function Page() {
  return <ServicesView />;
}
