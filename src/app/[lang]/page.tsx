import { redirect } from "next/navigation";

// "/" → el dashboard (si no hay sesión, el AuthGuard redirige al login).
export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  redirect(`/${lang}/dashboard`);
}
