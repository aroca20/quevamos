# Quevamos: código base (Expo)

Proyecto de Expo con TypeScript, creado con la plantilla `blank-typescript` del SDK 57. Acompaña a la guía «Quevamos — Guía: Windows, Expo y proyecto base».

## Qué contiene

| Carpeta o archivo | Para qué sirve |
| --- | --- |
| `src/motor/` | Motor de disponibilidad: estados, reglas, canal de chat y acciones. Sin interfaz ni red |
| `src/ahora/` | Pantalla «Ahora», su modelo y el editor del estado personalizado |
| `src/ui/` | Colores en modo claro y oscuro e iconos de cada estado |
| `App.tsx` | Punto de entrada de la app |
| `app.json` | Nombre, icono y ajustes de la app |
| `AGENTS.md` | Instrucciones para asistentes de programación |

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

Cada cambio que llega a GitHub pasa por tipos, estilo y pruebas, con la configuración de `.github/workflows/comprobaciones.yml`. El resultado aparece en la pestaña Actions del repositorio: si algo falla, el cambio no se da por bueno.

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
