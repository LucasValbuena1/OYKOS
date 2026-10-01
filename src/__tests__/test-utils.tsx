// Utilidades compartidas por las pruebas: render con Providers (i18n + toasts).
import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import es from "@/app/[lang]/dictionaries/es.json";
import en from "@/app/[lang]/dictionaries/en.json";
import { I18nProvider } from "@/i18n/I18nProvider";
import { ToastProvider } from "@/components/ui/Toast";
import type { Dictionary } from "@/i18n/types";
import { SessionProvider, type SessionUser } from "@/context/SessionContext";

/** Usuario de sesión de Auth0 que usan las pruebas por defecto. */
export const TEST_USER: SessionUser = {
  sub: "auth0|test-user",
  name: "Lucas Valbuena",
  email: "lucas@oykos.co",
  emailVerified: true,
};

export const dictEs = es as Dictionary;
export const dictEn = en as Dictionary;

export function renderApp(
  ui: ReactElement,
  {
    locale = "es",
    auth0User = TEST_USER,
    configured = true,
    ...options
  }: { locale?: "es" | "en"; auth0User?: SessionUser | null; configured?: boolean } & RenderOptions = {},
) {
  // Si la prueba usa timers falsos, user-event debe avanzarlos al esperar.
  const user = userEvent.setup({
    advanceTimers: (ms) => {
      if ("clock" in setTimeout) jest.advanceTimersByTime(ms);
    },
  });
  const result = render(
    <I18nProvider dict={locale === "es" ? dictEs : dictEn} locale={locale}>
      <SessionProvider configured={configured} sessionUser={auth0User}>
        <ToastProvider>{ui}</ToastProvider>
      </SessionProvider>
    </I18nProvider>,
    options,
  );
  return { user, ...result };
}

export function mockRouter() {
  return (jest.requireMock("next/navigation") as { useRouter: () => Record<string, jest.Mock> }).useRouter();
}

export function setSearch(query: string) {
  (globalThis as unknown as { __setSearch: (q: string) => void }).__setSearch(query);
}

export function setPathname(path: string) {
  (globalThis as unknown as { __setPathname: (p: string) => void }).__setPathname(path);
}
