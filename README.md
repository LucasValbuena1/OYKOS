# Oykos · Front-end

**Oykos** centraliza la gestión económica de un hogar: facturas de servicios públicos, impuestos (predial, vehicular, valorización), vehículos y gastos fijos, con alertas, reportes y monitoreo de consumo.

Proyecto del curso **ISIS 3710 – Programación con Tecnologías Web** (Universidad de los Andes), ciclo 1.

| Integrante | GitHub | Funcionalidades |
|---|---|---|
| Felipe Ardila | fardilaq | Hogares (CRUD) · Reportes y exportación · Impuestos |
| Gabriela Campos | gabycamps | Facturas (CRUD) · Dashboard de consumo · Vehículos |
| Lucas Valbuena | LucasValbuena1 | Servicios públicos (CRUD) · Incidentes · Autenticación y perfil (Auth0) |
| Alejandro Guzmán | Aguzr10 | Alertas por consumo · Asistente IA · Escáner de recibos con IA |

Las historias de usuario detalladas están en la [wiki del repositorio](https://github.com/isis3710-uniandes/ISIS3710_202620_S4_E05_Front/wiki/Historias-de-usuario) y el diseño en [Figma](https://www.figma.com/design/d7vDA1ulmCyIxog7NpRm15/Oykos).

---

## 1. Ejecución con Docker (recomendado)

Requisitos: Docker Desktop 24+.

```bash
# 1. Construir la imagen (instala dependencias, CORRE LAS PRUEBAS y compila)
docker build -t oykos-front .

# 2. Ejecutar el contenedor
docker run --rm -p 3000:3000 --name oykos-front oykos-front
```

Abrir <http://localhost:3000>. El proxy redirige automáticamente a `/es` o `/en` según el idioma del navegador.

Con Docker Compose:

```bash
docker compose up --build        # levantar
docker compose down              # detener
```

La app necesita las variables de Auth0 y de Claude (secciones 4 y 8). Se pasan al contenedor desde `.env.local`:

```bash
docker run --rm -p 3000:3000 --env-file .env.local oykos-front
```

> Si Docker Hub responde `429 Too Many Requests` al descargar la imagen base, usar un espejo:
> `docker build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-alpine -t oykos-front .`

## 2. Ejecución local (desarrollo)

Requisitos: Node.js 20+ (probado con 22).

```bash
npm install
cp .env.example .env.local   # y completar Auth0 + ANTHROPIC_API_KEY
npm run dev          # http://localhost:3000
npm test             # pruebas unitarias (Jest + Testing Library)
npm run test:coverage
npm run lint
npm run typecheck
npm run build && npm start
```

## 3. Requisitos técnicos cubiertos

| Requisito | Cómo se cumple |
|---|---|
| Next.js + React + TypeScript | Next.js 16 (App Router), React 19, TypeScript estricto. |
| Fidelidad al Figma | Paleta, tipografía (Nunito Sans), radios y composición tomados del archivo de Figma (tokens en `src/app/globals.css`). |
| Internacionalización (i18n) | Rutas `/[lang]` (es/en), `src/proxy.ts` con redirección automática por `Accept-Language` y diccionarios JSON cargados de forma asíncrona en Server Components. |
| Accesibilidad (a11y) | HTML semántico, un `h1` por página, labels asociados, `aria-invalid`/`aria-describedby` en errores, diálogos con *focus trap* y Escape, `aria-live` para toasts y conteos, enlace "saltar al contenido", foco visible, estados con color + ícono + texto. |
| Hooks personalizados | Lógica de negocio y estados complejos en `src/hooks` (ver sección 6). |
| Pruebas unitarias | 241 pruebas, **mínimo 3 por cada historia de usuario** (58 HU implementadas). |
| Docker | `Dockerfile` multi-etapa (`output: "standalone"`), usuario sin privilegios; la imagen **no se construye si falla alguna prueba**. |
| Seguridad | Auth0 (Universal Login, MFA, recuperación de contraseña); rutas privadas protegidas en el servidor. |
| Inteligencia artificial | Claude (Anthropic) vía rutas de servidor `/api/ai/*`, con *structured outputs*, validación de la respuesta y *skeletons* de carga. |

## 4. Seguridad con Auth0

La autenticación (Lucas · F3) se hace **solo con Auth0**, con el SDK oficial `@auth0/nextjs-auth0` v4. Requiere `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET` y `AUTH0_SECRET`; si faltan, la pantalla de login indica qué configurar y no se puede entrar a las rutas privadas.

  - HU09: registro y login en Universal Login (`/auth/login`, `screen_hint=signup`, Google); el `proxy.ts` protege las rutas privadas **en el servidor**; `/auth/logout` cierra la sesión.
  - HU10: nombre, correo y foto vienen de la sesión de Auth0; el teléfono y el nombre visible se guardan como datos propios de Oykos. El correo lo administra Auth0.
  - HU11: verificación en dos pasos de Auth0 (app autenticadora, SMS o correo), opcional para cada usuario: desde **Perfil → Configurar o verificar MFA en Auth0** la app la pide con `acr_values`. Al volver, el perfil confirma el resultado y muestra "Verificado en esta sesión" (Auth0 lo informa en el claim `amr` del token, que la app guarda en la sesión con `beforeSessionSaved`).
  - HU12: "¿Olvidaste tu contraseña?" en Universal Login y cambio de contraseña autenticado con `POST /api/auth/change-password` (Auth0 envía el enlace temporal).

### Configuración en el panel de Auth0

1. Crear un tenant en <https://manage.auth0.com> (plan gratuito).
2. **Applications → Create Application → Regular Web Application**.
3. En *Settings* de la aplicación:
   - **Allowed Callback URLs:** `http://localhost:3000/auth/callback`
   - **Allowed Logout URLs:** `http://localhost:3000`
   - **Allowed Web Origins:** `http://localhost:3000`
4. Copiar **Domain**, **Client ID** y **Client Secret** a `.env.local` (plantilla en `.env.example`) y generar `AUTH0_SECRET` con `openssl rand -hex 32`.
5. **Authentication → Database:** dejar habilitada `Username-Password-Authentication` para la app (y opcionalmente *Social → Google*).
6. **Security → Multi-factor Auth:** activar al menos un factor (por ejemplo *One-time Password*) y en *Policies* dejar **"Never"** (así el MFA es opcional y lo pide la app).
   - **Actions → Library → Create Action** (trigger *Login / Post Login*), con este código, y luego **Deploy**:
     ```js
     exports.onExecutePostLogin = async (event, api) => {
       const acr = event.transaction?.acr_values ?? [];
       if (acr.includes("http://schemas.openid.net/pape/policies/2007/06/multi-factor")) {
         api.multifactor.enable("any", { allowRememberBrowser: false });
       }
     };
     ```
   - **Actions → Triggers → post-login:** arrastrar la Action entre *Start* y *Complete* y **Apply**. Sin esta Action, Auth0 ignora la solicitud de MFA con la política en "Never".
7. **Branding → Universal Login:** opcionalmente poner el logo y los colores de Oykos (`#24534c`).
8. Reiniciar `npm run dev` o el contenedor.

## 5. Internacionalización

- `src/i18n/config.ts`: idiomas soportados (`es`, `en`) e idioma por defecto (`es`).
- `src/proxy.ts`: si la URL no trae idioma, usa la cookie `oykos-locale` (preferencia elegida en el selector), luego `Accept-Language` (Negotiator + `@formatjs/intl-localematcher`) y por último `es`.
- `src/app/[lang]/dictionaries.ts`: `getDictionary()` lee el idioma con `next/root-params` y carga el JSON con `import()` dinámico (solo el idioma usado; nunca viaja al cliente completo).
- El layout entrega el diccionario a un `I18nProvider`, y los Client Components lo usan con `useI18n()` (también formatea moneda COP, fechas y plurales según el idioma).
- El tipo `Dictionary` se deriva de `es.json`: si falta una clave en un idioma o en un componente, TypeScript falla. Hay además una prueba que verifica que `es.json` y `en.json` tengan las mismas claves.

## 6. Arquitectura y justificaciones técnicas

```
src/
├─ proxy.ts                  # Auth0 + redirección de idioma
├─ app/[lang]/               # rutas por idioma
│  ├─ (auth)/                # login, registro, recuperar (redirigen a Auth0)
│  ├─ (app)/                 # rutas privadas (AppShell: menú + encabezado)
│  ├─ dictionaries/*.json    # textos es / en
│  └─ dictionaries.ts        # carga asíncrona de diccionarios
├─ app/api/auth/change-password/route.ts
├─ app/api/ai/                # scan-receipt y assistant (llaman a Claude)
├─ lib/ai/                    # cliente de Claude (solo servidor) y validación
├─ components/               # UI por dominio + ui/ (Button, Field, Modal, Toast, BarChart…)
├─ hooks/                    # hooks personalizados (lógica y estado)
├─ lib/domain/               # reglas de negocio puras y probadas
├─ lib/store.ts              # store persistente (localStorage + useSyncExternalStore)
├─ data/                     # colecciones y datos de ejemplo
└─ __tests__/<integrante>/   # pruebas por historia de usuario
```

- **Separación lógica / interfaz.** Las reglas de negocio (validaciones, vencimientos, proyecciones, cuotas, descuentos, alertas, costos de vehículos, reportes) son funciones puras en `src/lib/domain`. Los componentes solo muestran información y llaman hooks. Así se evita código duplicado y se prueba la lógica sin la interfaz.
- **Hooks personalizados.** `useCollection` (CRUD genérico), `useHouseholds`/`useServices`/`useVehicles` (eliminación en cascada), `useInvoices`, `useIncidents` (bitácora de estados), `useNotifications` (evaluación de reglas sin duplicados), `useAuth` (sesión de Auth0 + perfil propio), `useReceiptScanner` (máquina de estados del escaneo), `useAssistant` (cálculos + Claude con caché por huella de datos), `useDueReminders` (avisos de vencimiento), `useForm` (valores, *touched*, validación onBlur y foco al primer error), `useDashboard` + `useConsumptionFilters`, `useReportBuilder` (selección, validación, estado de carga, historial), `useTaxDetail` (cuotas, descuento, pago, histórico), `useInvoiceFilters`, `useDisclosure`, `useAsyncTask`, `useFocusTrap`.
- **Persistencia en localStorage con `useSyncExternalStore`.** No hay backend: la app corre en `localhost` y los datos del hogar viven en el navegador. Cada colección es un store externo que todos los componentes comparten (se sincroniza incluso entre pestañas). El SSR usa el valor inicial, así que no hay errores de hidratación. En el ciclo 2 solo se reemplaza `src/data/stores.ts` por llamadas a la API, sin tocar hooks ni componentes.
- **Datos de ejemplo relativos a "hoy".** Los datos iniciales se generan desde la fecha actual, así siempre hay facturas vencidas o por vencer, descuentos vigentes e historial para las proyecciones y el asistente.
- **Gráficas sin librerías.** `BarChart` es propia, liviana y accesible (tabla oculta para lectores de pantalla).
- **Exportación.** PDF con `jsPDF` (se carga solo al exportar) y Excel en SpreadsheetML (`.xls`) sin dependencias.
- **Tailwind CSS v4** con los tokens del Figma declarados en `@theme`.
- **Renderizado dinámico del layout** (`force-dynamic`): la sesión de Auth0 vive en cookies, así que no puede quedar fija en el build.

## 7. Pruebas

```bash
npm test
```

- Jest + React Testing Library + user-event (`jest.config.ts`, `jest.setup.ts`).
- `src/__tests__/<integrante>/<funcionalidad>.test.tsx`: un `describe` por HU con **3 o más** casos (criterios de aceptación: listados, validaciones, confirmaciones, cascadas, estados vacíos, cálculos).
- `src/__tests__/general`: proxy de idioma, rutas privadas/Auth0, diccionarios, accesibilidad de componentes base y store.
- Las llamadas a Claude y a Auth0 se reemplazan por dobles de prueba (`jest.fn`) **solo dentro de las pruebas**; la app siempre usa los servicios reales.
- Resultado actual: **16 suites · 241 pruebas · 0 fallos**.

## 8. Funcionalidades con IA (Alejandro) — Claude

Las dos funcionalidades de IA usan la **API de Claude (Anthropic)** con el SDK oficial `@anthropic-ai/sdk`. La API key vive solo en el servidor (`ANTHROPIC_API_KEY` en `.env.local`): el navegador llama a las rutas `/api/ai/*`, que exigen sesión de Auth0 y luego llaman a Claude. Se usan *structured outputs* (`output_config.format` con JSON Schema) para recibir siempre JSON, y la respuesta se valida antes de usarla (`sanitizeExtraction`, `sanitizeAssistant`): nunca se confía en el modelo tal cual.

**F2 · Asistente IA** (`/asistente`, `POST /api/ai/assistant`)

- HU06 predicción del próximo mes por servicio (≥ 3 meses de historial), marcada como estimación.
- HU07 perfil de consumo (bajo / moderado / alto) frente a la referencia de hogares del mismo estrato; Claude redacta la explicación.
- HU08 recomendaciones de ahorro personalizadas por Claude, con ahorro estimado (acotado al gasto real) y opción de descartarlas.
- HU09 score de sostenibilidad 0–100 ponderado (energía 45 %, agua 35 %, gas 20 %), rangos y evolución mensual.
- Los números los calcula la app (funciones puras en `lib/domain/assistant.ts`); Claude solo explica y recomienda. La respuesta se guarda por "huella" de datos, así no se vuelve a llamar a la API hasta que cambian las facturas.

**F3 · Escáner de recibos** (`/facturas/escanear`, `POST /api/ai/scan-receipt`)

- HU10 carga de JPG, PNG o PDF (máx. 5 MB) con pasos visibles, *skeleton* de carga y reintento sin volver a subir el archivo.
- HU11 extracción con nivel de confianza por campo; los campos dudosos o no detectados se resaltan.
- HU12 fecha de corte y fecha límite normalizadas (varios formatos) y aviso si ya venció.
- HU13 revisión y validación antes de guardar (mismas reglas del registro manual); descartar pide confirmación.
- HU14 link de pago (ver abajo), HU15 pagar abriendo el portal oficial en otra pestaña y marcar como pagada con comprobante, HU16 estado de cada paso del procesamiento con reintento del paso fallido.
- HU17 avisos de vencimiento configurables (p. ej. 5 y 1 día antes) en el centro de notificaciones y en la campana del encabezado.

**Link de pago (HU14) — scraping con IA + enlaces de respaldo** (`POST /api/payment-link`, `lib/paymentLinkService.ts`)

Ninguna de las empresas publica una API para terceros, así que el servidor de Oykos hace *scraping* de sus páginas **públicas** y Claude decide:

1. **Descarga** la página pública de la empresa (`fetch`, *timeout* de 6 s, `User-Agent` que identifica a Oykos) y sigue las redirecciones por JavaScript o `<meta refresh>`.
2. **Extrae los enlaces** con su texto (incluye `alt` de imágenes y `aria-label`) y deja solo los `https` de los **dominios oficiales** de esa empresa.
3. **Claude (Haiku 4.5, `temperature: 0`) elige por número** el enlace que abre el pago en línea o, si no está, la página del mismo sitio a la que conviene ir (hasta **2 saltos**: "la IA navega"). Responder por número impide que invente URLs; el código vuelve a validar dominio y confianza (≥ 0,6). Los textos de la página se tratan como datos, no como instrucciones.
4. Si una página llega sin enlaces (armada con JavaScript) y **Playwright** está instalado, se abre en un navegador sin interfaz. Es opcional: `npm i -D playwright && npx playwright install chromium`.
5. Sin `ANTHROPIC_API_KEY` se usa el patrón conocido de cada empresa; si nada funciona, el **enlace de respaldo** al portal oficial.
6. **Caché** en memoria: 6 h por empresa (como máximo una llamada a Claude por empresa cada 6 h); un respaldo, solo 10 min para que reintentar sirva.

**Cómo se obtiene el link en cada empresa** (verificado en octubre de 2026):

| Empresa | Cómo lo hace Oykos | Link que obtiene |
|---|---|---|
| EPM | Abre la página de inicio de EPM. Ahí hay un enlace "Paga tu factura" y Claude lo elige. | `aplicaciones.epm.com.co/facturaweb` |
| Vanti | Abre la página "Paga tu factura" de Vanti, donde está el botón de pago en línea, y Claude lo elige. | `pagosenlinea.grupovanti.com` |
| Claro | Abre la página "Portal de pagos" de Claro. Hay varias opciones (app, WhatsApp, pago de personas…) y Claude elige la de pago en línea para personas. | `portalpagos.claro.com.co` |
| Air-e | Abre la página de inicio de Air-e. Ahí está el botón de pago por PSE y Claude lo elige. | `portal.air-e.com/Pagar` |
| Acueducto | La página de inicio solo redirige a otra, así que Oykos sigue esa redirección. En el portal no está el botón, pero sí la sección "Pagos": Claude decide entrar ahí y en esa página encuentra el botón "Pagos PSE". Revisa 2 páginas. | `acueducto.com.co/mioficinavirtual` |
| Enel | La página de Enel no deja entrar a programas automáticos (responde "acceso denegado"). Oykos no intenta saltarse ese bloqueo y usa el link de respaldo, que es la página oficial del botón de pago. | `enel.com.co/.../boton-de-pago.html` (respaldo) |
| ETB | Igual que Enel: la página solo responde a navegadores reales. Se usa el link de respaldo a su portal de pagos. | `etb.com/pagos` (respaldo) |

En todos los casos Claude solo puede escoger entre los enlaces de la página que van a sitios oficiales de la empresa; si escoge algo raro o no está seguro, Oykos busca el link con una regla fija por empresa y, si tampoco lo encuentra, usa el link de respaldo.

**No se evaden bloqueos anti-bot ni captchas**: si el sitio responde 401/403/429/503 se respeta y se usa el respaldo. El pago siempre lo termina el usuario en el portal oficial con la referencia que muestra Oykos (botón para copiarla). La factura indica si el link lo encontró la IA (y cuántas páginas revisó), un patrón o es de respaldo, y el paso aparece en el estado del procesamiento (HU16) con reintento. Variables opcionales: `ANTHROPIC_LINK_MODEL` (modelo para elegir enlaces) y `OYKOS_DISABLE_BROWSER=1`.

**Errores controlados:** sin sesión → 401; sin `ANTHROPIC_API_KEY` → 503 con mensaje que explica qué configurar; recibo ilegible → 422; falla de Claude → 502. La interfaz muestra cada caso y permite reintentar.

**Privacidad:** a Claude solo se envía el recibo (para leerlo) o un resumen numérico del hogar (sin nombre, correo ni dirección del usuario).
