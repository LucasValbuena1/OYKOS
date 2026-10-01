// Layout raíz por idioma. Carga el diccionario en el SERVIDOR (asíncrono) y lo
// entrega al I18nProvider para los Client Components.
import type { Metadata } from "next";
import "@fontsource-variable/nunito-sans";
import "../globals.css";
import { getDictionary } from "./dictionaries";
import { locales, type Locale } from "@/i18n/config";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider, type SessionUser } from "@/context/SessionContext";
import { auth0 } from "@/lib/auth0";

// La sesión de Auth0 vive en cookies: el layout se renderiza en cada petición
// para que el estado de autenticación nunca quede "congelado" en el build.
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return {
    title: { default: dict.meta.title, template: `%s · Oykos` },
    description: dict.meta.description,
  };
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  const dict = await getDictionary();
  // Sesión de Auth0 leída en el servidor
  const session = auth0 ? await auth0.getSession() : null;
  const sessionUser: SessionUser | null = session
    ? {
        sub: session.user.sub,
        name: session.user.name,
        email: session.user.email,
        picture: session.user.picture,
        emailVerified: session.user.email_verified,
      }
    : null;
  return (
    <html lang={lang}>
      <body className="min-h-screen antialiased">
        <I18nProvider dict={dict} locale={lang as Locale}>
          <SessionProvider configured={!!auth0} sessionUser={sessionUser}>
            <ToastProvider>{children}</ToastProvider>
          </SessionProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
