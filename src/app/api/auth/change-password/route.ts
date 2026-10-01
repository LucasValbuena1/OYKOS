// POST /api/auth/change-password — HU12 (modo Auth0).
// Pide a Auth0 que envíe al correo del usuario autenticado el enlace para
// cambiar la contraseña (endpoint público /dbconnections/change_password).
// Auth0 aplica sus políticas: vigencia del enlace, fortaleza y no repetir.
import { NextResponse } from "next/server";
import { auth0, AUTH0_DB_CONNECTION } from "@/lib/auth0";

export async function POST() {
  if (!auth0) return NextResponse.json({ error: "auth0_not_configured" }, { status: 501 });
  const session = await auth0.getSession();
  if (!session?.user.email) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const res = await fetch(`https://${process.env.AUTH0_DOMAIN}/dbconnections/change_password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT_ID,
      email: session.user.email,
      connection: AUTH0_DB_CONNECTION,
    }),
  });
  if (!res.ok) return NextResponse.json({ error: "auth0_error" }, { status: 502 });
  return NextResponse.json({ ok: true });
}
