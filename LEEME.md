# Quevamos

Repositorio de Quevamos: la app, en la raíz, y el servidor, en `servidor/`. La app es un proyecto de Expo con TypeScript, creado con la plantilla `blank-typescript` del SDK 57; acompaña a la guía «Quevamos — Guía: Windows, Expo y proyecto base». El servidor tiene su propio [LEEME](servidor/LEEME.md).

## Qué contiene

| Carpeta o archivo | Para qué sirve |
| --- | --- |
| `src/motor/` | Motor de disponibilidad: estados, reglas, canal de chat y acciones. Sin interfaz ni red |
| `src/ahora/` | Pantalla «Ahora», su modelo y el editor del estado personalizado |
| `src/ui/` | Colores en modo claro y oscuro e iconos de cada estado |
| `App.tsx` | Punto de entrada de la app |
| `app.json` | Nombre, icono y ajustes de la app |
| `AGENTS.md` | Instrucciones para asistentes de programación |
| `servidor/` | API de la app con Node.js y Fastify: cuentas, sesiones y, más adelante, el resto de módulos |

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm install` | Instala las dependencias. Solo la primera vez o al cambiar `package.json` |
| `npx expo start` | Arranca el servidor; escanea el código QR con la cámara del iPhone |
| `npm run web` | Abre la app en el navegador del PC, para revisar cambios rápidos |
| `npm test` | Pasa las 24 pruebas: 17 del motor y 7 de la pantalla «Ahora» |
| `npm run typecheck` | Revisa los tipos de TypeScript |
| `npm run lint` | Revisa el estilo del código |

## Comprobaciones automáticas

Cada cambio que llega a GitHub pasa por tipos, estilo y pruebas, de la app y del servidor, con la configuración de `.github/workflows/comprobaciones.yml`. Las pruebas del servidor se ejecutan con PGlite y con un PostgreSQL de verdad. El resultado aparece en la pestaña Actions del repositorio: si algo falla, el cambio no se da por bueno.

## Los estados

- Cuatro fijos: Verde (disponible), Amarillo (depende), Rojo (no molestar) y Desconocido (no muestra su estado).
- Uno personalizado por persona: nombre de hasta 16 caracteres, un color de la paleta cerrada (Cielo, Añil, Lavanda, Orquídea o Rosa) y funciona como Verde, Amarillo o Rojo.
- El chat, los avisos y la proximidad se deciden por el nivel de cada estado, nunca por su nombre.

## Versión del SDK

El proyecto usa el SDK 57 porque es el que admite Expo Go en la App Store a 29 de octubre de 2026. Cuando Expo Go pase al SDK 58, actualiza con:

```
npx expo install expo@^58.0.0 --fix
npm install --save-dev jest@^30 @types/jest@^30
npx expo-doctor@latest
npm test
```

El SDK 58 necesita Jest 30 para las pruebas; por eso va la segunda línea.

## Publicar en TestFlight

La app se compila en la nube de Expo, sin Mac, y llega a tu iPhone por TestFlight. La primera vez se hace desde tu PC, porque Apple pide tu contraseña y el código de doble factor. Después basta un botón en GitHub.

### Configuración inicial (una sola vez)

1. En PowerShell, desde la carpeta del repositorio, inicia sesión en Expo:
   ```
   npx eas-cli@27 login
   ```
2. Lanza la primera compilación y su envío a App Store Connect:
   ```
   npx eas-cli@27 build --platform ios --profile production --auto-submit
   ```
   Contesta que sí a crear el proyecto de EAS, entra con tu cuenta de Apple Developer y deja que EAS genere el certificado, el perfil de aprovisionamiento y la clave de App Store Connect. Cuando pregunte el nombre de la app en la tienda, prueba con «Quevamos»; si está cogido, elige una variante.
3. Esa compilación añade el identificador del proyecto a `app.json`. En VS Code, confirma ese cambio desde Control de código fuente y sincroniza.
4. En App Store Connect, abre la app, entra en Información de la app y copia su Apple ID: un número de unos diez dígitos. Hay que ponerlo en `eas.json` como `ascAppId` (Claude puede hacerlo).
5. En expo.dev, crea un token de acceso desde la configuración de tu cuenta («Access tokens») y guárdalo en GitHub como secreto `EXPO_TOKEN`: Settings → Secrets and variables → Actions → New repository secret.
6. Instala TestFlight en el iPhone. EAS crea un grupo de pruebas interno; si no ves la app, añádete como probador interno en App Store Connect, en la pestaña TestFlight.

### Cada versión nueva

En GitHub: pestaña Actions → «TestFlight» → «Run workflow». Primero pasan las pruebas y luego Expo compila; Apple te avisa por correo cuando la versión está lista en TestFlight. El número de compilación sube solo.

El plan gratuito de Expo da 15 compilaciones de iOS al mes y las pone en una cola lenta: lánzalo cuando haya algo que probar en el iPhone, no con cada cambio.

El identificador de la app es `com.quevamos.app` y no se puede cambiar.
