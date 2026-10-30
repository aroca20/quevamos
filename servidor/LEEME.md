# Servidor de Quevamos

API de la app con Node.js, TypeScript y Fastify. Por ahora tiene las cuentas: acceso sin contraseña con un código por correo, sesiones, perfil, exportación de datos y borrado de cuenta. Es la base del monolito modular de la especificación: cada parte nueva (comunidades, estados, reglas, chat) será un módulo más en `src/modulos/`.

## Arrancarlo en tu PC

Desde la carpeta del repositorio, en PowerShell:

```
cd servidor
npm install
npm run dev
```

El servidor queda en http://localhost:3000. No hace falta instalar PostgreSQL: en desarrollo usa PGlite, que es el mismo PostgreSQL dentro del propio proceso, y guarda los datos en la carpeta `.datos`. Bórrala para empezar de cero.

Todavía no envía correos: el código de acceso aparece en la consola del servidor, en una línea que empieza por `[desarrollo]`.

## Probarlo a mano

En otra ventana de PowerShell, con tu correo:

```
$api = "http://localhost:3000"
Invoke-RestMethod -Method Post -Uri "$api/v1/auth/codigo" -ContentType "application/json" -Body '{"email":"tu@correo.es"}'
```

Copia el código de la consola del servidor y sigue:

```
$acceso = Invoke-RestMethod -Method Post -Uri "$api/v1/auth/verificar" -ContentType "application/json" -Body '{"email":"tu@correo.es","codigo":"123456"}'
$cabeceras = @{ Authorization = "Bearer $($acceso.token)" }
Invoke-RestMethod -Uri "$api/v1/yo" -Headers $cabeceras
Invoke-RestMethod -Method Patch -Uri "$api/v1/yo" -Headers $cabeceras -ContentType "application/json; charset=utf-8" -Body '{"nombreVisible":"Ana","mayorDeEdad":true}'
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Arranca el servidor y lo reinicia al guardar un cambio |
| `npm test` | Pasa las pruebas con PGlite; con `DATABASE_URL_PRUEBAS`, también con PostgreSQL |
| `npm run typecheck` | Revisa los tipos |
| `npm run lint` | Revisa el estilo |
| `npm run build` | Genera `dist/principal.js` para producción |

## Rutas

| Método y ruta | Sesión | Qué hace |
| --- | --- | --- |
| `GET /salud` | No | Comprueba que el servidor responde |
| `POST /v1/auth/codigo` | No | Envía un código de seis cifras. Responde 202 exista o no la cuenta |
| `POST /v1/auth/verificar` | No | Comprueba el código, crea la cuenta si es nueva y devuelve el token de sesión |
| `POST /v1/auth/cerrar-sesion` | Sí | Cierra la sesión actual |
| `GET /v1/yo` | Sí | Perfil: alias, mayoría de edad, zona horaria y duración del Verde |
| `PATCH /v1/yo` | Sí | Cambia el perfil. Tras el primer acceso, la app pide alias y mayoría de edad |
| `GET /v1/yo/exportar` | Sí | Todos los datos de la cuenta, para el derecho de acceso y portabilidad |
| `DELETE /v1/yo` | Sí | Borra la cuenta. Pide `{"confirmar": true}` |

La sesión va en la cabecera `Authorization: Bearer <token>`. Los errores siempre tienen la forma `{"error": {"codigo": "...", "mensaje": "..."}}`, con un código estable para la app y un mensaje en español.

## Decisiones de seguridad

- **Sin contraseñas.** Códigos de seis cifras que caducan a los 10 minutos, se bloquean al quinto fallo y solo vale el último. Cada dirección puede pedir cinco por hora, y cada IP, cinco por minuto.
- **Tokens que no se pueden robar de la base de datos.** El token de sesión tiene 256 bits aleatorios y solo se guarda su hash SHA-256. Caduca a los 90 días sin uso.
- **El correo nunca se guarda en claro.** Se guarda un HMAC para buscarlo y una copia cifrada con AES-256-GCM para poder escribirte.
- **Borrado real.** Al borrar la cuenta se quitan al momento el correo y el alias y se cierran todas las sesiones; la fila anónima se purga a los 30 días.
- **Sin pistas.** Pedir un código responde igual exista o no la cuenta, y los errores internos no dan detalles.
- **Cabeceras de seguridad**, límite de 16 KB por petición y registros sin el token de sesión.
- **Claves fuera del código.** En producción, el servidor no arranca sin base de datos ni con las claves de `.env.example`.

## Variables de entorno

| Variable | Para qué |
| --- | --- |
| `NODE_ENV` | `development`, `test` o `production` |
| `PUERTO`, `HOST` | Dónde escucha el servidor |
| `DATABASE_URL` | PostgreSQL. Sin ella, PGlite en `DIRECTORIO_DATOS` |
| `CLAVE_HMAC`, `CLAVE_CIFRADO` | Claves de 32 bytes en base64, distintas entre sí |
| `ORIGENES_PERMITIDOS` | Orígenes de navegador admitidos, separados por comas |
| `CONFIAR_EN_PROXY` | `true` solo detrás del proxy del proveedor |

En desarrollo se leen de `.env` o, si no existe, de `.env.example`. En producción se definen en el proveedor.

## Pendiente

- Proveedor de correo con servidores en la UE para enviar los códigos de verdad.
- Tarea diaria que llame a la purga de cuentas borradas.
- «Iniciar sesión con Apple», si se decide ofrecerlo.
- Filtro de contenido del alias, con el módulo de moderación.
- Redis para los límites y el tiempo real cuando haya más de un servidor.
- Despliegue en un proveedor de la UE con PostgreSQL gestionado.
