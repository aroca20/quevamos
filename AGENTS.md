# Quevamos

App móvil de conexión presencial: cada persona muestra su disponibilidad (Verde, Amarillo, Rojo, Desconocido o un estado personalizado) a sus comunidades. Hecha con Expo (React Native) y TypeScript, iOS primero. Se desarrolla desde Windows y se prueba en un iPhone con Expo Go.

## Estructura

- `src/motor/`: motor de disponibilidad. Funciones puras, sin interfaz ni red. Es la lógica de la especificación: estado efectivo, canal de chat y acciones.
- `src/ahora/`: pantalla «Ahora», su modelo (funciones puras) y el editor del estado personalizado.
- `src/ui/`: colores en modo claro y oscuro e iconos de los estados.
- Las pruebas viven en carpetas `__tests__` junto al código que prueban.
- `servidor/`: API con Node.js, TypeScript y Fastify, como proyecto aparte con su `package.json`. Monolito modular: cada parte va en `servidor/src/modulos/<nombre>/` con su `servicio.ts` (lógica y SQL) y sus `rutas.ts` (HTTP y validación con zod). Usa el mismo motor de la app a través de `servidor/src/motor.ts`. Sus pruebas están en `servidor/test/`.

## Comandos

```bash
npx expo install <paquete>  # instala siempre así: elige versiones compatibles con el SDK
npx expo start              # arranca el servidor de desarrollo
npm test                    # pruebas con Jest
npm run typecheck           # comprobación de tipos
npm run lint                # estilo del código
```

En el servidor, desde `servidor/`:

```bash
npm run dev                 # arranca con PGlite en .datos/; el código de acceso sale en la consola
npm test                    # pruebas con Vitest (PGlite; también PostgreSQL si hay DATABASE_URL_PRUEBAS)
npm run typecheck
npm run lint
npm run build               # dist/principal.js
```

Antes de dar un cambio por terminado: pruebas, tipos y lint sin errores, en la app y en el servidor. GitHub Actions repite esas comprobaciones en cada cambio (`.github/workflows/comprobaciones.yml`).

## Reglas

- El chat, los avisos y la proximidad dependen del nivel de cada estado, nunca de su nombre. Un estado personalizado tiene el nivel del color con el que funciona.
- Mientras se use Expo Go, solo valen los módulos que incluye Expo Go. Un módulo con código nativo propio exige una compilación de desarrollo (`eas build --profile development`).
- No crees ni edites a mano las carpetas `ios/` y `android/`: se generan a partir de `app.json` y los plugins de configuración.
- Nada de secretos en el código ni en variables `EXPO_PUBLIC_`: se incrustan en la app y cualquiera puede leerlos.
- Antes de usar una API de Expo, consulta la documentación de la versión del SDK que indique `package.json`.
- El identificador de la app es `com.quevamos.app` y es permanente: no lo cambies.
- Las compilaciones se hacen con EAS (`eas.json`, perfil `production`, número de compilación gestionado por EAS). `.github/workflows/testflight.yml` se lanza a mano porque el plan gratuito da 15 compilaciones de iOS al mes; necesita el secreto `EXPO_TOKEN` y `ascAppId` en `eas.json`.
- `src/motor/` lo usan la app y el servidor: no puede importar nada de Expo ni de React Native. Tiene su propio `tsconfig.json` y un `package.json` que lo marca como ESM para que el servidor lo cargue sin las dependencias de la app.
- Servidor: las migraciones de `servidor/src/bd/migraciones.ts` no se editan una vez publicadas; un cambio de esquema es una migración nueva al final. Todo el SQL va con parámetros (`$1`, `$2`…), nunca concatenando datos.
- Servidor: nunca registres ni devuelvas tokens, códigos de acceso ni correos en claro; la única excepción es `CorreoConsola`, que solo existe en desarrollo. Los errores para la app se lanzan con `ErrorApi` (código estable y mensaje en español).
- Servidor: las claves y la conexión a la base de datos solo llegan por variables de entorno.
