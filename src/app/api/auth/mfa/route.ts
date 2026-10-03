// DELETE /api/auth/mfa — HU11: desactivar la verificación en dos pasos.
// Por seguridad exige que el inicio de sesión actual haya pasado por el
// segundo factor (mfa_verified); si no, la app pide verificar primero.
import { NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { removeMfaMethods } from "@/lib/auth0Management";

export async function DELETE() {
  if (!auth0) return NextResponse.json({ error: "auth0_not_configured" }, { status: 501 });
  const session = await auth0.getSession();
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (session.user.mfa_verified !== true) return NextResponse.json({ error: "mfaRequired" }, { status: 403 });
  try {
    await removeMfaMethods(session.user.sub);
  } catch (e) {
    console.error("[mfa] no se pudo desactivar", (e as Error).message);
    return NextResponse.json({ error: "auth0_error" }, { status: 502 });
  }
  await auth0.updateSession({ ...session, user: { ...session.user, mfa_enrolled: false, mfa_verified: false } });
  return NextResponse.json({ ok: true });
}
