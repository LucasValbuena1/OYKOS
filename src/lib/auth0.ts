// Cliente de Auth0 (servidor). Seguridad de Lucas · F3 (HU09–HU12).
//
// Requiere AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET y AUTH0_SECRET
// (ver .env.example). Auth0 se encarga de registro, login, recuperación de
// contraseña, verificación de correo y MFA (Universal Login). Si faltan las
// variables, `auth0` es null y la app muestra cómo configurarlo.
import { Auth0Client } from "@auth0/nextjs-auth0/server";

import { isAuth0Configured } from "./authRoutes";

export const auth0 = isAuth0Configured()
  ? new Auth0Client({
      signInReturnToPath: "/",
      authorizationParameters: {
        scope: "openid profile email",
      },
    })
  : null;

/** Conexión de base de datos de Auth0 (usuario + contraseña). */
export const AUTH0_DB_CONNECTION = process.env.AUTH0_DB_CONNECTION ?? "Username-Password-Authentication";
