import { construirApp } from './app';
import { abrirBaseDatos } from './bd';
import { migrar } from './bd/migrar';
import { cargarConfig } from './config';
import { CorreoConsola } from './correo';
import { ServicioCuentas } from './modulos/cuentas/servicio';

/** Fuera de producción, lee .env y, si no existe, .env.example. */
function cargarVariablesLocales(): void {
  if (process.env.NODE_ENV === 'production') return;
  for (const archivo of ['.env', '.env.example']) {
    try {
      process.loadEnvFile(archivo);
      return;
    } catch {
      // No existe: prueba con el siguiente.
    }
  }
}

async function principal(): Promise<void> {
  cargarVariablesLocales();
  const config = cargarConfig(process.env);
  if (config.NODE_ENV === 'production') {
    throw new Error('Falta conectar un proveedor de correo para enviar los códigos: aún no se puede usar en producción.');
  }

  const bd = await abrirBaseDatos(
    config.DATABASE_URL
      ? { tipo: 'postgres', url: config.DATABASE_URL }
      : { tipo: 'pglite', directorio: config.DIRECTORIO_DATOS },
  );
  const aplicadas = await migrar(bd);
  const servicio = new ServicioCuentas(
    bd,
    { hmac: config.CLAVE_HMAC, cifrado: config.CLAVE_CIFRADO },
    new CorreoConsola(),
  );
  const app = await construirApp({
    servicio,
    entorno: config.NODE_ENV,
    origenes: config.ORIGENES_PERMITIDOS,
    confiarEnProxy: config.CONFIAR_EN_PROXY,
  });
  if (aplicadas.length > 0) app.log.info(`Migraciones aplicadas: ${aplicadas.join(', ')}`);

  const cerrar = async () => {
    await app.close();
    await bd.cerrar();
    process.exit(0);
  };
  process.once('SIGINT', cerrar);
  process.once('SIGTERM', cerrar);

  await app.listen({ port: config.PUERTO, host: config.HOST });
}

principal().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
