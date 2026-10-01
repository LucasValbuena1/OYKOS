"use client";
// Pantallas de autenticación (Lucas · HU09 y HU12). Registro, login,
// "olvidé mi contraseña" y MFA ocurren en Universal Login de Auth0; la app solo
// redirige a /auth/login con los parámetros adecuados.
import { KeyRound, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/i18n/I18nProvider";
import { auth0LoginUrl, type Auth0Intent } from "@/lib/authRoutes";
import { buttonClasses } from "@/components/ui/Button";
import { ErrorAlert, InfoNote } from "@/components/ui/Feedback";
import { useSession } from "@/context/SessionContext";
import { AuthCard } from "./AuthCard";

function useReturnTo() {
  const params = useSearchParams();
  const { href } = useI18n();
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : href("/dashboard");
}

/** Enlace a Auth0: se usa <a> (no <Link>) para no disparar el login con el prefetch. */
export function Auth0Link({ intent, returnTo, children, variant = "primary" }: { intent: Auth0Intent; returnTo: string; children: React.ReactNode; variant?: "primary" | "outline" | "tonal" }) {
  const { locale } = useI18n();
  return (
    <a href={auth0LoginUrl(intent, returnTo, locale)} className={buttonClasses(variant, "lg", "w-full rounded-2xl")}>
      {children}
    </a>
  );
}

/** Aviso cuando faltan las variables de Auth0 en .env.local. */
function NotConfigured() {
  const { dict } = useI18n();
  return (
    <AuthCard title={dict.auth0.notConfiguredTitle}>
      <ErrorAlert>{dict.auth0.notConfigured}</ErrorAlert>
      <code className="rounded-xl bg-white p-4 text-xs break-all whitespace-pre-line">
        AUTH0_DOMAIN{"\n"}AUTH0_CLIENT_ID{"\n"}AUTH0_CLIENT_SECRET{"\n"}AUTH0_SECRET
      </code>
    </AuthCard>
  );
}

export function Auth0Login() {
  const { dict } = useI18n();
  const returnTo = useReturnTo();
  const { configured } = useSession();
  if (!configured) return <NotConfigured />;
  return (
    <AuthCard title={dict.auth.welcomeBack} subtitle={dict.auth0.loginSubtitle}>
      <div className="flex flex-col gap-4">
        <Auth0Link intent="login" returnTo={returnTo}>
          <LogIn aria-hidden="true" className="size-5" /> {dict.auth.login}
        </Auth0Link>
        <Auth0Link intent="google" returnTo={returnTo} variant="outline">
          {dict.auth.google}
        </Auth0Link>
        <Auth0Link intent="signup" returnTo={returnTo} variant="tonal">
          <UserPlus aria-hidden="true" className="size-5" /> {dict.auth.createAccount}
        </Auth0Link>
        <InfoNote>
          <ShieldCheck aria-hidden="true" className="mr-2 inline size-4" />
          {dict.auth0.securedBy}
        </InfoNote>
      </div>
    </AuthCard>
  );
}

export function Auth0Signup() {
  const { dict } = useI18n();
  const returnTo = useReturnTo();
  const { configured } = useSession();
  if (!configured) return <NotConfigured />;
  return (
    <AuthCard title={dict.auth.registerTitle} subtitle={dict.auth0.signupSubtitle}>
      <Auth0Link intent="signup" returnTo={returnTo}>
        <UserPlus aria-hidden="true" className="size-5" /> {dict.auth.createAccount}
      </Auth0Link>
      <Auth0Link intent="login" returnTo={returnTo} variant="tonal">
        {dict.auth.haveAccount} {dict.auth.login}
      </Auth0Link>
    </AuthCard>
  );
}

export function Auth0Recovery() {
  const { dict } = useI18n();
  const returnTo = useReturnTo();
  const { configured } = useSession();
  if (!configured) return <NotConfigured />;
  return (
    <AuthCard title={dict.auth.recoverTitle} subtitle={dict.auth0.recoverSubtitle}>
      <Auth0Link intent="login" returnTo={returnTo}>
        <KeyRound aria-hidden="true" className="size-5" /> {dict.auth0.goToRecovery}
      </Auth0Link>
    </AuthCard>
  );
}
