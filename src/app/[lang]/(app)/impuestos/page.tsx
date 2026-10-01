import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { TaxesView } from "@/components/taxes/TaxesView";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.taxes };
}

export default function Page() {
  return <TaxesView />;
}
