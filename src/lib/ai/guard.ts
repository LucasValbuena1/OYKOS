// Protección de las rutas de IA: exigen sesión de Auth0 para que la API key de
// Claude solo la use un usuario autenticado de Oykos.
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";

export async function requireSession(): Promise<NextResponse | null> {
  if (!auth0) return NextResponse.json({ error: "authNotConfigured" }, { status: 503 });
  const session = await auth0.getSession();
  return session ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
