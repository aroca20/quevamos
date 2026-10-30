import { describe, expect, it } from 'vitest';

import {
  cifrar,
  descifrar,
  generarCodigo,
  generarToken,
  hashToken,
  hmac,
  igualesSeguro,
  normalizarEmail,
  uuidv7,
} from '../src/cripto';
import { CLAVES } from './ayudas';

describe('Criptografía', () => {
  it('genera UUID v7 válidos y ordenados por fecha', () => {
    const formato = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    const antes = uuidv7(1_700_000_000_000);
    const despues = uuidv7(1_700_000_000_001);
    expect(antes).toMatch(formato);
    expect(despues).toMatch(formato);
    expect(antes < despues).toBe(true);
  });

  it('normaliza el correo', () => {
    expect(normalizarEmail('  Ana.Garcia@Ejemplo.ES ')).toBe('ana.garcia@ejemplo.es');
  });

  it('cifra y descifra, con un resultado distinto cada vez', () => {
    const a = cifrar(CLAVES.cifrado, 'ana@ejemplo.es');
    const b = cifrar(CLAVES.cifrado, 'ana@ejemplo.es');
    expect(a.equals(b)).toBe(false);
    expect(a.includes(Buffer.from('ana@ejemplo.es'))).toBe(false);
    expect(descifrar(CLAVES.cifrado, a)).toBe('ana@ejemplo.es');
  });

  it('detecta un cifrado alterado o una clave equivocada', () => {
    const paquete = cifrar(CLAVES.cifrado, 'ana@ejemplo.es');
    const alterado = Buffer.from(paquete);
    alterado[alterado.length - 1] ^= 1;
    expect(() => descifrar(CLAVES.cifrado, alterado)).toThrow();
    expect(() => descifrar(CLAVES.hmac, paquete)).toThrow();
  });

  it('genera códigos de seis cifras y tokens de 256 bits', () => {
    for (let i = 0; i < 50; i++) expect(generarCodigo()).toMatch(/^\d{6}$/);
    expect(Buffer.from(generarToken(), 'base64url')).toHaveLength(32);
    expect(hashToken('x')).toHaveLength(32);
  });

  it('el HMAC depende de la clave', () => {
    expect(hmac(CLAVES.hmac, 'a').equals(hmac(CLAVES.hmac, 'a'))).toBe(true);
    expect(hmac(CLAVES.hmac, 'a').equals(hmac(CLAVES.cifrado, 'a'))).toBe(false);
  });

  it('compara en tiempo constante sin fallar con longitudes distintas', () => {
    expect(igualesSeguro(Buffer.from('abc'), Buffer.from('abc'))).toBe(true);
    expect(igualesSeguro(Buffer.from('abc'), Buffer.from('abd'))).toBe(false);
    expect(igualesSeguro(Buffer.from('abc'), Buffer.from('abcd'))).toBe(false);
  });
});
