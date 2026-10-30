# Quevamos

App móvil de conexión presencial: cada persona muestra su disponibilidad (Verde, Amarillo, Rojo, Desconocido o un estado personalizado) a sus comunidades. Hecha con Expo (React Native) y TypeScript, iOS primero. Se desarrolla desde Windows y se prueba en un iPhone con Expo Go.

## Estructura

- `src/motor/`: motor de disponibilidad. Funciones puras, sin interfaz ni red. Es la lógica de la especificación: estado efectivo, canal de chat y acciones.
- `src/ahora/`: pantalla «Ahora», su modelo (funciones puras) y el editor del estado personalizado.
- `src/ui/`: colores en modo claro y oscuro e iconos de los estados.
- Las pruebas viven en carpetas `__tests__` junto al código que prueban.

## Comandos

```bash
npx expo install <paquete>  # instala siempre así: elige versiones compatibles con el SDK
npx expo start              # arranca el servidor de desarrollo
npm test                    # pruebas con Jest
npm run typecheck           # comprobación de tipos
npm run lint                # estilo del código
```

Antes de dar un cambio por terminado: pruebas, tipos y lint sin errores. GitHub Actions repite esas tres comprobaciones en cada cambio (`.github/workflows/comprobaciones.yml`).

## Reglas

- El chat, los avisos y la proximidad dependen del nivel de cada estado, nunca de su nombre. Un estado personalizado tiene el nivel del color con el que funciona.
- Mientras se use Expo Go, solo valen los módulos que incluye Expo Go. Un módulo con código nativo propio exige una compilación de desarrollo (`eas build --profile development`).
- No crees ni edites a mano las carpetas `ios/` y `android/`: se generan a partir de `app.json` y los plugins de configuración.
- Nada de secretos en el código ni en variables `EXPO_PUBLIC_`: se incrustan en la app y cualquiera puede leerlos.
- Antes de usar una API de Expo, consulta la documentación de la versión del SDK que indique `package.json`.
