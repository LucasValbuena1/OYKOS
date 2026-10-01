import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { TaxDetail } from "@/components/taxes/TaxDetail";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.taxes };
}

export default async function Page({ params }: PageProps<"/[lang]/impuestos/[id]">) {
  const { id } = await params;
  return <TaxDetail id={id} />;
}
