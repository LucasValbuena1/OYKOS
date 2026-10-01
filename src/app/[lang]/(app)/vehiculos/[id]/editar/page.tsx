import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.vehicleEdit };
}

export default async function Page({ params }: PageProps<"/[lang]/vehiculos/[id]/editar">) {
  const { id } = await params;
  return <VehicleForm id={id} />;
}
