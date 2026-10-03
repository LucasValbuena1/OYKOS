// Management API de Auth0 — SOLO servidor (HU11: desactivar la verificación
// en dos pasos). Usa las credenciales de la aplicación Oykos con el grant
// "Client Credentials" y los permisos read/delete:authentication_methods.
import { MFA_METHOD_TYPES } from "@/lib/authRoutes";

let cached: { token: string; expires: number } | null = null;

async function managementToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const domain = process.env.AUTH0_DOMAIN;
  const res = await fetch(`https://${domain}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "client_credentials",
      client_id: process.env.AUTH0_CLIENT_ID,
      client_secret: process.env.AUTH0_CLIENT_SECRET,
      audience: `https://${domain}/api/v2/`,
    }),
  });
  if (!res.ok) throw new Error(`management_token_${res.status}`);
  const body = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function api(path: string, init: RequestInit = {}) {
  const token = await managementToken();
  return fetch(`https://${process.env.AUTH0_DOMAIN}/api/v2${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
  });
}

/** Elimina todos los segundos factores del usuario. Devuelve cuántos quitó. */
export async function removeMfaMethods(userId: string): Promise<number> {
  const id = encodeURIComponent(userId);
  const res = await api(`/users/${id}/authentication-methods`);
  if (!res.ok) throw new Error(`list_methods_${res.status}`);
  const methods = (await res.json()) as { id: string; type: string }[];
  const mfa = methods.filter((m) => MFA_METHOD_TYPES.includes(m.type));
  for (const m of mfa) {
    const del = await api(`/users/${id}/authentication-methods/${encodeURIComponent(m.id)}`, { method: "DELETE" });
    if (!del.ok && del.status !== 404) throw new Error(`delete_method_${del.status}`);
  }
  return mfa.length;
}
