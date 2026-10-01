import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { NotificationsCenter } from "@/components/alerts/NotificationsCenter";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.notifications };
}

export default function Page() {
  return <NotificationsCenter />;
}
