// Lucas · Funcionalidad 3 (HU09–HU12) con Auth0: la app delega registro,
// login, MFA y contraseñas en Universal Login y conserva solo los datos de
// perfil propios de Oykos (nombre visible, teléfono, foto) en localStorage.
import { screen, within } from "@testing-library/react";
import { Auth0Login, Auth0Recovery, Auth0Signup } from "@/components/auth/Auth0Screens";
import { ProfileView } from "@/components/profile/ProfileView";
import { AuthGuard } from "@/components/layout/AppShell";
import { profilesStore } from "@/data/stores";
import { validateProfile } from "@/lib/domain/profile";
import { auth0LoginUrl, hasMfaEnrolled, isPrivatePath, MFA_ENROLLED_CLAIM, usedMfa } from "@/lib/authRoutes";
import { mockRouter, renderApp, setSearch, TEST_USER } from "../test-utils";

describe("HU09 · Registro / login con Auth0", () => {
  it("el login redirige a Universal Login conservando la ruta de regreso", () => {
    setSearch("next=/es/facturas");
    renderApp(<Auth0Login />, { auth0User: null });
    expect(screen.getByRole("link", { name: /Iniciar sesión/ })).toHaveAttribute("href", "/auth/login?returnTo=%2Fes%2Ffacturas&ui_locales=es");
    expect(screen.getByRole("link", { name: "Continuar con Google" }).getAttribute("href")).toContain("connection=google-oauth2");
  });

  it("el registro abre la pantalla de registro de Auth0", () => {
    renderApp(<Auth0Signup />, { auth0User: null });
    expect(screen.getAllByRole("link", { name: /Crear cuenta/ })[0].getAttribute("href")).toContain("screen_hint=signup");
  });

  it("con sesión de Auth0 las rutas privadas se muestran", () => {
    renderApp(<AuthGuard>contenido privado</AuthGuard>);
    expect(screen.getByText("contenido privado")).toBeInTheDocument();
  });

  it("sin sesión no se muestra el contenido privado", () => {
    renderApp(<AuthGuard>contenido privado</AuthGuard>, { auth0User: null, configured: false });
    expect(screen.queryByText("contenido privado")).not.toBeInTheDocument();
    expect(mockRouter().replace).toHaveBeenCalledWith("/es/login");
  });

  it("si faltan las variables de Auth0 explica qué configurar", () => {
    renderApp(<Auth0Login />, { auth0User: null, configured: false });
    expect(screen.getByRole("alert")).toHaveTextContent(".env.local");
    expect(screen.queryByRole("link", { name: /Iniciar sesión/ })).not.toBeInTheDocument();
  });

  it("identifica las rutas públicas y privadas", () => {
    expect(isPrivatePath("/es/dashboard")).toBe(true);
    expect(isPrivatePath("/en/login")).toBe(false);
    expect(auth0LoginUrl("mfa", "/es/perfil", "es")).toContain("acr_values=");
  });
});

describe("HU10 · Editar perfil", () => {
  it("muestra los datos de la sesión de Auth0 y el correo no es editable", () => {
    renderApp(<ProfileView />);
    expect(screen.getByLabelText(/Nombre completo/)).toHaveValue(TEST_USER.name);
    expect(screen.getByLabelText(/Correo electrónico/)).toBeDisabled();
    expect(screen.getByText("El correo lo administra tu cuenta de Auth0.")).toBeInTheDocument();
  });

  it("guarda teléfono y nombre visible como datos propios de Oykos", async () => {
    const { user } = renderApp(<ProfileView />);
    await user.type(screen.getByLabelText(/Teléfono/), "+57 300 123 4567");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(profilesStore.get()[TEST_USER.sub]).toMatchObject({ phone: "+57 300 123 4567", name: TEST_USER.name });
  });

  it("valida el formato del teléfono", async () => {
    const { user } = renderApp(<ProfileView />);
    await user.type(screen.getByLabelText(/Teléfono/), "abc");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(screen.getByText(/Ingresa un teléfono válido/)).toBeInTheDocument();
  });

  it("valida el nombre obligatorio", () => {
    expect(validateProfile({ name: " ", phone: "" }).name).toBe("required");
    expect(validateProfile({ name: "L", phone: "" }).name).toBe("minLength");
    expect(validateProfile({ name: "Lucas", phone: "" })).toEqual({});
  });
});

describe("HU11 · MFA con Auth0", () => {
  it("ofrece activar la verificación en dos pasos solicitando el factor adicional", () => {
    renderApp(<ProfileView />);
    const link = screen.getByRole("link", { name: /Activar verificación en dos pasos/ });
    expect(link.getAttribute("href")).toContain("acr_values=");
    expect(link.getAttribute("href")).toContain("returnTo=%2Fes%2Fperfil%3Fmfa%3D1");
  });

  it("explica que al activarla se pedirá el código en cada inicio de sesión", () => {
    renderApp(<ProfileView />);
    expect(screen.getByText(/Auth0 te pedirá un código cada vez que inicies sesión/)).toBeInTheDocument();
  });

  it("no muestra un interruptor de 2FA propio", () => {
    renderApp(<ProfileView />);
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("detecta si el inicio de sesión usó segundo factor (claim amr de Auth0)", () => {
    expect(usedMfa({ amr: ["pwd", "mfa"] })).toBe(true);
    expect(usedMfa({ amr: ["pwd"] })).toBe(false);
    expect(usedMfa({})).toBe(false);
    expect(usedMfa(null)).toBe(false);
  });

  it("al volver de Auth0 con el segundo factor confirma que quedó activa", async () => {
    setSearch("mfa=1");
    renderApp(<ProfileView />, { auth0User: { ...TEST_USER, mfaVerified: true } });
    expect(await screen.findByText(/Verificación en dos pasos activada/)).toBeInTheDocument();
    expect(mockRouter().replace).toHaveBeenCalledWith("/es/perfil");
  });

  it("con la verificación activa muestra el estado y no ofrece activarla de nuevo", () => {
    renderApp(<ProfileView />, { auth0User: { ...TEST_USER, mfaEnabled: true } });
    expect(screen.getByText("Activa")).toBeInTheDocument();
    expect(screen.getByText(/en cada inicio de sesión/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Activar verificación en dos pasos/ })).not.toBeInTheDocument();
  });

  it("si Auth0 no pidió el segundo factor avisa que revise la configuración", async () => {
    setSearch("mfa=1");
    renderApp(<ProfileView />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Auth0 no pidió el segundo factor");
    expect(screen.queryByText("Activa")).not.toBeInTheDocument();
  });

  it("recuerda en la sesión si el usuario tiene el factor inscrito (claim de la Action)", () => {
    expect(hasMfaEnrolled({ [MFA_ENROLLED_CLAIM]: true })).toBe(true);
    expect(hasMfaEnrolled({ [MFA_ENROLLED_CLAIM]: false })).toBe(false);
    expect(hasMfaEnrolled({})).toBe(false);
    renderApp(<ProfileView />);
    expect(screen.getByText("Inactiva")).toBeInTheDocument();
  });
});

describe("HU11 · Desactivar la verificación en dos pasos", () => {
  const enabledUser = { ...TEST_USER, mfaEnabled: true, mfaVerified: true };
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("pide confirmación antes de desactivarla", async () => {
    const { user } = renderApp(<ProfileView />, { auth0User: enabledUser });
    await user.click(screen.getByRole("button", { name: "Desactivar verificación en dos pasos" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("ya no se pedirá el código");
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("al confirmar la quita en Auth0 y actualiza el perfil", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, status: 200 });
    const { user } = renderApp(<ProfileView />, { auth0User: enabledUser });
    await user.click(screen.getByRole("button", { name: "Desactivar verificación en dos pasos" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Desactivar verificación en dos pasos" }));
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/mfa", { method: "DELETE" });
    expect(await screen.findByText("Verificación en dos pasos desactivada.")).toBeInTheDocument();
    expect(mockRouter().refresh).toHaveBeenCalled();
  });

  it("si la sesión no pasó por el segundo factor, pide verificarlo primero", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403 });
    const { user } = renderApp(<ProfileView />, { auth0User: { ...enabledUser, mfaVerified: false } });
    await user.click(screen.getByRole("button", { name: "Desactivar verificación en dos pasos" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Desactivar verificación en dos pasos" }));
    expect(await screen.findByText(/primero confirma tu segundo factor/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Verificar mi segundo factor/ }).getAttribute("href")).toContain("acr_values=");
  });
});

describe("HU12 · Recuperar / cambiar contraseña con Auth0", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("la recuperación se hace en Universal Login", () => {
    renderApp(<Auth0Recovery />, { auth0User: null });
    expect(screen.getByRole("link", { name: /Ir a recuperar contraseña/ }).getAttribute("href")).toMatch(/^\/auth\/login/);
  });

  it("cambiar contraseña pide a Auth0 enviar el correo", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });
    const { user } = renderApp(<ProfileView />);
    await user.click(screen.getByRole("button", { name: "Enviar correo para cambiar contraseña" }));
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/change-password", { method: "POST" });
    expect(await screen.findByText(/Auth0 te envió el enlace/)).toBeInTheDocument();
  });

  it("si Auth0 falla muestra un error", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const { user } = renderApp(<ProfileView />);
    await user.click(screen.getByRole("button", { name: "Enviar correo para cambiar contraseña" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo solicitar el cambio de contraseña");
  });
});
