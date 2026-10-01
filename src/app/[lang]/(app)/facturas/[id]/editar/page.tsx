import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { InvoiceForm } from "@/components/invoices/InvoiceForm";

// Server Component: carga el diccionario de forma asíncrona para el título.
export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.invoiceEdit };
}

export default async function Page({ params }: PageProps<"/[lang]/facturas/[id]/editar">) {
  const { id } = await params;
  return <InvoiceForm id={id} />;
}
