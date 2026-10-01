import Link from "next/link";
import { getDictionary } from "./dictionaries";
import { lang } from "next/root-params";

export default async function NotFound() {
  const dict = await getDictionary();
  const locale = await lang();
  return (
    <main id="contenido" className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-6xl font-black text-primary">404</p>
      <h1 className="text-3xl font-extrabold">{dict.notFound.title}</h1>
      <p className="text-on-surface-variant">{dict.notFound.description}</p>
      <Link href={`/${locale}/dashboard`} className="font-bold text-primary underline">
        {dict.notFound.back}
      </Link>
    </main>
  );
}
