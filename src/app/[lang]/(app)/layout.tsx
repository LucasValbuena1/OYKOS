import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Spinner } from "@/components/ui/Feedback";

// Todas las rutas privadas comparten Aside + Header y la protección de sesión.
export default function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={<Spinner size="lg" />}>{children}</Suspense>
    </AppShell>
  );
}
