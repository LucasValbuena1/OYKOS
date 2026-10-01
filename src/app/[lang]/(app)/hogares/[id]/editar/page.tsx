import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { HouseholdForm } from "@/components/households/HouseholdForm";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.householdEdit };
}

export default async function Page({ params }: PageProps<"/[lang]/hogares/[id]/editar">) {
  const { id } = await params;
  return <HouseholdForm id={id} />;
}
