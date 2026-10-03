/**
 * @jest-environment node
 */
// DELETE /api/auth/mfa (HU11): desactiva la verificación en dos pasos con la
// Management API de Auth0. Auth0 y fetch se simulan solo en la prueba.
const getSession = jest.fn();
const updateSession = jest.fn();
jest.mock("@/lib/auth0", () => ({ auth0: { getSession: () => getSession(), updateSession: (s: unknown) => updateSession(s) } }));

import { DELETE } from "@/app/api/auth/mfa/route";

const realFetch = global.fetch;
const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
const user = { sub: "google-oauth2|123", mfa_enrolled: true, mfa_verified: true };

beforeEach(() => {
  jest.clearAllMocks();
  process.env.AUTH0_DOMAIN = "oykos-test.us.auth0.com";
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterAll(() => {
  global.fetch = realFetch;
});

describe("DELETE /api/auth/mfa", () => {
  it("sin sesión responde 401 y sin haber verificado el segundo factor 403", async () => {
    getSession.mockResolvedValue(null);
    expect((await DELETE()).status).toBe(401);
    getSession.mockResolvedValue({ user: { ...user, mfa_verified: false } });
    expect(await (await DELETE()).json()).toEqual({ error: "mfaRequired" });
  });

  it("quita solo los segundos factores y actualiza la sesión", async () => {
    getSession.mockResolvedValue({ user });
    global.fetch = jest.fn((url: string, init?: RequestInit) => {
      if (url.endsWith("/oauth/token")) return Promise.resolve(json({ access_token: "t", expires_in: 3600 }));
      if (init?.method === "DELETE") return Promise.resolve(json({}, 204));
      return Promise.resolve(json([{ id: "totp|1", type: "totp" }, { id: "pwd|1", type: "password" }]));
    }) as unknown as typeof fetch;
    expect((await DELETE()).status).toBe(200);
    const deletes = (global.fetch as jest.Mock).mock.calls.filter(([, i]) => i?.method === "DELETE").map(([u]) => u);
    expect(deletes).toEqual(["https://oykos-test.us.auth0.com/api/v2/users/google-oauth2%7C123/authentication-methods/totp%7C1"]);
    expect(updateSession).toHaveBeenCalledWith({ user: { ...user, mfa_enrolled: false, mfa_verified: false } });
  });

  it("si Auth0 falla responde 502 y no cambia la sesión", async () => {
    getSession.mockResolvedValue({ user });
    global.fetch = jest.fn().mockResolvedValue(json({}, 500)) as unknown as typeof fetch;
    expect((await DELETE()).status).toBe(502);
    expect(updateSession).not.toHaveBeenCalled();
  });
});
