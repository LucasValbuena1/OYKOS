import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { HouseholdsView } from "@/components/households/HouseholdsView";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.households };
}

export default async function Page({ params }: PageProps<"/[lang]/hogares/[id]">) {
  const { id } = await params;
  return <HouseholdsView selectedId={id} />;
}
