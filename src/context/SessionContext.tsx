"use client";
// Sesión de Auth0 leída en el servidor (layout) y entregada a los Client
// Components. `configured` indica si existen las variables de Auth0.
import { createContext, useContext, type ReactNode } from "react";

export interface SessionUser {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  emailVerified?: boolean;
}

interface SessionValue {
  configured: boolean;
  sessionUser: SessionUser | null;
}

const SessionContext = createContext<SessionValue>({ configured: false, sessionUser: null });

export function SessionProvider({ configured, sessionUser, children }: SessionValue & { children: ReactNode }) {
  return <SessionContext.Provider value={{ configured, sessionUser }}>{children}</SessionContext.Provider>;
}

export const useSession = () => useContext(SessionContext);
