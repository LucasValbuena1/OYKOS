"use client";
// Estructura de las páginas privadas: Aside + Header + contenido.
// Protege las rutas privadas: sin sesión redirige al login (HU09 Lucas).
import { useEffect, useRef, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/hooks/useAuth";
import { auth0LoginUrl } from "@/lib/authRoutes";
import { useHydrated } from "@/hooks/useStore";
import { useNotifications } from "@/hooks/useDomain";
import { useDueReminders } from "@/hooks/useDueReminders";
import { useDisclosure, useFocusTrap } from "@/hooks/useUi";
import { Spinner } from "@/components/ui/Feedback";
import { IconButton } from "@/components/ui/Button";
import { Aside } from "./Aside";
import { Header } from "./Header";

export function AuthGuard({ children }: { children: ReactNode }) {
  const hydrated = useHydrated();
  const { isAuthenticated, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { dict, href, locale } = useI18n();

  useEffect(() => {
    if (!hydrated || isAuthenticated) return;
    // El proxy ya protege en el servidor; esto cubre sesiones que expiran en el cliente
    if (configured) window.location.assign(auth0LoginUrl("login", pathname, locale));
    else router.replace(href("/login"));
  }, [hydrated, isAuthenticated, configured, router, pathname, href, locale]);

  if (!hydrated || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-primary">
        <Spinner size="lg" label={dict.common.loading} />
      </div>
    );
  }
  return <>{children}</>;
}

/**
 * Al entrar a la app evalúa las reglas de alerta (HU04/HU05) y los avisos de
 * vencimiento (HU17), y repite la revisión de vencimientos cada hora.
 */
function AlertEvaluator() {
  const { evaluate } = useNotifications();
  const { evaluate: evaluateDue } = useDueReminders();
  useEffect(() => {
    evaluate();
    evaluateDue();
    const timer = setInterval(() => evaluateDue(), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, [evaluate, evaluateDue]);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const drawer = useDisclosure();
  const drawerRef = useRef<HTMLDivElement>(null);
  const { dict } = useI18n();
  useFocusTrap(drawerRef, drawer.isOpen, drawer.close);

  return (
    <AuthGuard>
      <AlertEvaluator />
      <a
        href="#contenido"
        className="sr-only z-50 rounded-xl bg-primary px-4 py-2 text-on-primary focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        {dict.common.skipToContent}
      </a>
      <div className="flex min-h-screen">
        <div className="no-print hidden shrink-0 border-r border-outline-variant bg-surface-container lg:block">
          <div className="sticky top-0 h-screen">
            <Aside />
          </div>
        </div>
        {drawer.isOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden">
            <div aria-hidden="true" className="absolute inset-0 bg-on-surface/40" onClick={drawer.close} />
            <div ref={drawerRef} role="dialog" aria-modal="true" aria-label={dict.nav.label} className="relative h-full">
              <Aside id="mobile-nav" onNavigate={drawer.close} />
              <IconButton label={dict.header.closeMenu} onClick={drawer.close} className="absolute top-4 right-4">
                <X aria-hidden="true" className="size-5" />
              </IconButton>
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onOpenMenu={drawer.open} menuOpen={drawer.isOpen} menuId="mobile-nav" />
          <main id="contenido" tabIndex={-1} className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-4 pt-6 pb-16 outline-none md:px-10">
            {children}
          </main>
        </div>
      </div>
    </AuthGuard>
  );
}
