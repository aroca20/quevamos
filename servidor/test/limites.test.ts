import { describe, expect, it } from 'vitest';

import { construirApp } from '../src/app';
import { abrirBaseDatos } from '../src/bd';
import { migrar } from '../src/bd/migrar';
import { CorreoMemoria } from '../src/correo';
import { ServicioCuentas } from '../src/modulos/cuentas/servicio';
import { CLAVES } from './ayudas';

describe('Límites por IP', () => {
  it('frena a quien pide códigos sin parar, aunque cambie de dirección', async () => {
    const bd = await abrirBaseDatos({ tipo: 'pglite' });
    await migrar(bd);
    const app = await construirApp({
      servicio: new ServicioCuentas(bd, CLAVES, new CorreoMemoria()),
      entorno: 'test',
      limites: { codigoPorMinuto: 2 },
    });
    try {
      const pedir = (n: number) =>
        app.inject({ method: 'POST', url: '/v1/auth/codigo', payload: { email: `ip${n}@ejemplo.es` } });
      expect((await pedir(1)).statusCode).toBe(202);
      expect((await pedir(2)).statusCode).toBe(202);
      const tercera = await pedir(3);
      expect(tercera.statusCode).toBe(429);
      expect(tercera.json().error.codigo).toBe('demasiadas_peticiones');
    } finally {
      await app.close();
      await bd.cerrar();
    }
  });
});
