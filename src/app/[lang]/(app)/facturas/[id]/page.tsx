import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { InvoiceDetail } from "@/components/invoices/InvoiceDetail";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.invoices };
}

export default async function Page({ params }: PageProps<"/[lang]/facturas/[id]">) {
  const { id } = await params;
  return <InvoiceDetail id={id} />;
}
