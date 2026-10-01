import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { VehicleForm } from "@/components/vehicles/VehicleForm";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.vehicleNew };
}

export default function Page() {
  return <VehicleForm />;
}
