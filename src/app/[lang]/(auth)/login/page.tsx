import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { Auth0Login } from "@/components/auth/Auth0Screens";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.login };
}

export default function Page() {
  return <Auth0Login />;
}
