import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { ServiceForm } from "@/components/services/ServiceForm";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.serviceEdit };
}

export default async function Page({ params }: PageProps<"/[lang]/servicios/[id]/editar">) {
  const { id } = await params;
  return <ServiceForm id={id} />;
}
