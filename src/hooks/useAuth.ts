"use client";
// useAuth — sesión y perfil del usuario (Lucas · F3).
// La autenticación (registro, login, MFA, contraseñas) la hace Auth0; aquí se
// expone el usuario de la sesión combinado con los datos de perfil propios de
// Oykos (teléfono, foto, nombre visible), que se guardan en localStorage.
import { useCallback, useMemo } from "react";
import type { User } from "@/types";
import { profilesStore } from "@/data/stores";
import { useSession } from "@/context/SessionContext";
import { AUTH0_LOGOUT_URL } from "@/lib/authRoutes";
import { useStore } from "./useStore";

export type ProfileChanges = Partial<Pick<User, "name" | "phone" | "photo">>;

export function useAuth() {
  const { configured, sessionUser } = useSession();
  const [profiles, setProfiles] = useStore(profilesStore);

  const user = useMemo<User | null>(() => {
    if (!sessionUser) return null;
    const extra = profiles[sessionUser.sub] ?? {};
    return {
      id: sessionUser.sub,
      name: extra.name ?? sessionUser.name ?? sessionUser.email ?? "",
      email: sessionUser.email ?? "",
      phone: extra.phone ?? "",
      photo: extra.photo ?? sessionUser.picture,
      emailVerified: sessionUser.emailVerified ?? false,
      mfaEnabled: sessionUser.mfaEnabled ?? false,
      mfaVerified: sessionUser.mfaVerified ?? false,
    };
  }, [sessionUser, profiles]);

  /** Auth0 borra su cookie de sesión y la de Universal Login. */
  const logout = useCallback(() => window.location.assign(AUTH0_LOGOUT_URL), []);

  /** El correo y la contraseña los administra Auth0: aquí solo datos de perfil. */
  const updateProfile = useCallback(
    (changes: ProfileChanges) => {
      if (!sessionUser) return;
      setProfiles((prev) => ({ ...prev, [sessionUser.sub]: { ...prev[sessionUser.sub], ...changes } }));
    },
    [sessionUser, setProfiles],
  );

  return { configured, user, isAuthenticated: !!user, logout, updateProfile };
}
