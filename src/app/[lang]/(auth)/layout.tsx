import { Suspense, type ReactNode } from "react";

// Las pantallas de autenticación usan useSearchParams → se envuelven en Suspense.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
