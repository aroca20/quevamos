import { abrirBaseDatos, type BaseDatos } from '../src/bd';

/** Claves fijas de prueba. */
export const CLAVES = { hmac: Buffer.alloc(32, 1), cifrado: Buffer.alloc(32, 2) };

export interface MotorPruebas {
  nombre: string;
  abrir(): Promise<BaseDatos>;
}

/** Siempre PGlite; además PostgreSQL de verdad si hay DATABASE_URL_PRUEBAS (en GitHub Actions). */
export const MOTORES: MotorPruebas[] = [{ nombre: 'PGlite', abrir: () => abrirBaseDatos({ tipo: 'pglite' }) }];

const urlPruebas = process.env.DATABASE_URL_PRUEBAS;
if (urlPruebas) {
  MOTORES.push({
    nombre: 'PostgreSQL',
    async abrir() {
      const bd = await abrirBaseDatos({ tipo: 'postgres', url: urlPruebas });
      await bd.ejecutar('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
      return bd;
    },
  });
}

/** Reloj que solo avanza cuando la prueba lo pide. */
export function relojFalso(inicio = '2026-11-02T10:00:00Z') {
  let ahora = new Date(inicio).getTime();
  return {
    reloj: () => new Date(ahora),
    avanzar: (milisegundos: number) => {
      ahora += milisegundos;
    },
  };
}

export const MINUTO = 60_000;
export const DIA = 24 * 60 * MINUTO;
