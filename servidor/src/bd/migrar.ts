import type { BaseDatos } from './index';
import { MIGRACIONES, type Migracion } from './migraciones';

/** Cerrojo de PostgreSQL para que dos servidores no migren a la vez. */
const CERROJO_MIGRACIONES = 72_617_401;

/** Aplica las migraciones pendientes y devuelve sus nombres. */
export async function migrar(bd: BaseDatos, migraciones: readonly Migracion[] = MIGRACIONES): Promise<string[]> {
  await bd.ejecutar(
    'CREATE TABLE IF NOT EXISTS migraciones (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now())',
  );
  const aplicadas: string[] = [];
  for (const migracion of migraciones) {
    const aplicada = await bd.transaccion(async (tx) => {
      await tx.query('SELECT pg_advisory_xact_lock($1)::text', [CERROJO_MIGRACIONES]);
      const { rows } = await tx.query('SELECT 1 FROM migraciones WHERE nombre = $1', [migracion.nombre]);
      if (rows.length > 0) return false;
      await tx.ejecutar(migracion.sql);
      await tx.query('INSERT INTO migraciones (nombre) VALUES ($1)', [migracion.nombre]);
      return true;
    });
    if (aplicada) aplicadas.push(migracion.nombre);
  }
  return aplicadas;
}
