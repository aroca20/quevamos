import { mkdir } from 'node:fs/promises';

import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

/**
 * Acceso a la base de datos. En producción es PostgreSQL; en desarrollo y en las pruebas,
 * PGlite, que es el mismo PostgreSQL compilado a WebAssembly y no hay que instalar.
 */
export interface Consultas {
  /** Una sola sentencia, con parámetros $1, $2… */
  query<T = Record<string, unknown>>(sql: string, parametros?: unknown[]): Promise<{ rows: T[] }>;
  /** Varias sentencias seguidas, sin parámetros. Para las migraciones. */
  ejecutar(sql: string): Promise<void>;
}

export interface BaseDatos extends Consultas {
  /** Ejecuta `fn` en una transacción: si lanza un error, no se guarda nada. */
  transaccion<T>(fn: (tx: Consultas) => Promise<T>): Promise<T>;
  cerrar(): Promise<void>;
}

export type OpcionesBaseDatos =
  | { tipo: 'postgres'; url: string }
  /** Sin directorio, la base de datos vive en memoria y desaparece al cerrar. */
  | { tipo: 'pglite'; directorio?: string };

export async function abrirBaseDatos(opciones: OpcionesBaseDatos): Promise<BaseDatos> {
  return opciones.tipo === 'postgres' ? abrirPostgres(opciones.url) : abrirPglite(opciones.directorio);
}

interface ConsultorPglite {
  query<T>(sql: string, parametros?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}

function envolverPglite(consultor: ConsultorPglite): Consultas {
  return {
    async query<T>(sql: string, parametros: unknown[] = []) {
      const { rows } = await consultor.query<T>(sql, parametros);
      return { rows };
    },
    async ejecutar(sql: string) {
      await consultor.exec(sql);
    },
  };
}

async function abrirPglite(directorio?: string): Promise<BaseDatos> {
  if (directorio) await mkdir(directorio, { recursive: true });
  const db = directorio ? await PGlite.create(directorio) : await PGlite.create();
  return {
    ...envolverPglite(db),
    transaccion: (fn) => db.transaction((tx) => fn(envolverPglite(tx))),
    cerrar: () => db.close(),
  };
}

function envolverPg(consultor: pg.Pool | pg.PoolClient): Consultas {
  return {
    async query<T>(sql: string, parametros: unknown[] = []) {
      const resultado = await consultor.query(sql, parametros);
      return { rows: resultado.rows as T[] };
    },
    async ejecutar(sql: string) {
      await consultor.query(sql);
    },
  };
}

async function abrirPostgres(url: string): Promise<BaseDatos> {
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  return {
    ...envolverPg(pool),
    async transaccion(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await fn(envolverPg(cliente));
        await cliente.query('COMMIT');
        return resultado;
      } catch (error) {
        await cliente.query('ROLLBACK');
        throw error;
      } finally {
        cliente.release();
      }
    },
    cerrar: () => pool.end(),
  };
}
