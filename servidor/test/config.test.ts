import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CLAVES_DE_EJEMPLO, cargarConfig } from '../src/config';

const claveNueva = (relleno: number) => Buffer.alloc(32, relleno).toString('base64');

describe('Configuración', () => {
  it('las claves de .env.example están en la lista de claves que no valen en producción', () => {
    const ejemplo = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    const claves = [...ejemplo.matchAll(/^CLAVE_\w+=(.+)$/gm)].map((m) => m[1]);
    expect(claves).toHaveLength(2);
    for (const clave of claves) expect(CLAVES_DE_EJEMPLO).toContain(clave);
  });

  it('en desarrollo arranca con PGlite y valores por defecto', () => {
    const config = cargarConfig({ CLAVE_HMAC: claveNueva(1), CLAVE_CIFRADO: claveNueva(2) });
    expect(config.NODE_ENV).toBe('development');
    expect(config.PUERTO).toBe(3000);
    expect(config.DATABASE_URL).toBeUndefined();
    expect(config.ORIGENES_PERMITIDOS).toEqual([]);
    expect(config.CONFIAR_EN_PROXY).toBe(false);
  });

  it('rechaza claves que no son de 32 bytes o que son iguales', () => {
    expect(() => cargarConfig({ CLAVE_HMAC: 'corta', CLAVE_CIFRADO: claveNueva(2) })).toThrow(/CLAVE_HMAC/);
    expect(() => cargarConfig({ CLAVE_HMAC: claveNueva(1), CLAVE_CIFRADO: claveNueva(1) })).toThrow(/distintas/);
  });

  it('en producción exige base de datos y claves propias', () => {
    const base = { NODE_ENV: 'production', CLAVE_HMAC: claveNueva(1), CLAVE_CIFRADO: claveNueva(2) };
    expect(() => cargarConfig(base)).toThrow(/DATABASE_URL/);
    const conBd = { ...base, DATABASE_URL: 'postgres://u:c@servidor:5432/quevamos' };
    expect(cargarConfig(conBd).NODE_ENV).toBe('production');
    expect(() => cargarConfig({ ...conBd, CLAVE_HMAC: CLAVES_DE_EJEMPLO[0] })).toThrow(/\.env\.example/);
  });
});
