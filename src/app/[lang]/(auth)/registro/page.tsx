import type { Metadata } from "next";
import { getDictionary } from "@/app/[lang]/dictionaries";
import { Auth0Signup } from "@/components/auth/Auth0Screens";

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.pages.register };
}

export default function Page() {
  return <Auth0Signup />;
}
