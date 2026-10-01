import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { AlertRuleDetail } from "@/components/alerts/AlertRuleDetail";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.alertEdit };
}

export default async function Page({ params }: PageProps<"/[lang]/alertas/[id]">) {
  const { id } = await params;
  return <AlertRuleDetail id={id} />;
}
