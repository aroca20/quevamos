import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { construirApp } from '../src/app';
import type { BaseDatos } from '../src/bd';
import { migrar } from '../src/bd/migrar';
import { CorreoMemoria } from '../src/correo';
import { normalizarEmail } from '../src/cripto';
import { type Perfil, ServicioCuentas } from '../src/modulos/cuentas/servicio';
import { CLAVES, DIA, MINUTO, MOTORES, relojFalso } from './ayudas';

const SIN_LIMITES_HTTP = { generalPorMinuto: 10_000, codigoPorMinuto: 10_000, verificarPorMinuto: 10_000 };

describe.each(MOTORES)('Cuentas con $nombre', ({ abrir }) => {
  let bd: BaseDatos;
  let app: FastifyInstance;
  let servicio: ServicioCuentas;
  const correo = new CorreoMemoria();
  const tiempo = relojFalso();
  let contador = 0;

  beforeAll(async () => {
    bd = await abrir();
    await migrar(bd);
    servicio = new ServicioCuentas(bd, CLAVES, correo, tiempo.reloj);
    app = await construirApp({ servicio, entorno: 'test', limites: SIN_LIMITES_HTTP });
  });

  afterAll(async () => {
    await app?.close();
    await bd?.cerrar();
  });

  /** Una dirección distinta en cada prueba, para que no se mezclen los límites. */
  const nuevoCorreo = () => `persona${++contador}@ejemplo.es`;
  const pedirCodigo = (email: string) => app.inject({ method: 'POST', url: '/v1/auth/codigo', payload: { email } });
  const verificar = (email: string, codigo: string) =>
    app.inject({ method: 'POST', url: '/v1/auth/verificar', payload: { email, codigo, dispositivo: 'iPhone' } });
  const conToken = (token: string) => ({ authorization: `Bearer ${token}` });
  const codigoDe = (email: string) => {
    const codigo = correo.ultimoCodigo(normalizarEmail(email));
    if (!codigo) throw new Error(`No se ha enviado ningún código a ${email}`);
    return codigo;
  };
  const otroCodigo = (codigo: string) => (codigo === '000000' ? '000001' : '000000');

  async function entrar(email: string): Promise<{ token: string; usuario: Perfil; nuevo: boolean }> {
    expect((await pedirCodigo(email)).statusCode).toBe(202);
    const respuesta = await verificar(email, codigoDe(email));
    expect(respuesta.statusCode).toBe(200);
    return respuesta.json();
  }

  it('crea la cuenta con el primer código y deja el perfil pendiente', async () => {
    const email = nuevoCorreo();
    const acceso = await entrar(email);
    expect(acceso.nuevo).toBe(true);
    expect(acceso.token.length).toBeGreaterThan(40);
    expect(acceso.usuario).toMatchObject({ nombreVisible: null, mayorDeEdad: false, perfilCompleto: false });
    expect(acceso.usuario.zonaHoraria).toBe('Europe/Madrid');

    const otraVez = await entrar(email.toUpperCase());
    expect(otraVez.nuevo).toBe(false);
    expect(otraVez.usuario.id).toBe(acceso.usuario.id);
  });

  it('responde igual exista o no la cuenta', async () => {
    const existente = nuevoCorreo();
    await entrar(existente);
    const a = await pedirCodigo(existente);
    const b = await pedirCodigo(nuevoCorreo());
    expect([a.statusCode, b.statusCode]).toEqual([202, 202]);
    expect(a.body).toBe(b.body);
  });

  it('nunca guarda el correo en claro', async () => {
    const email = nuevoCorreo();
    const { usuario } = await entrar(email);
    const { rows } = await bd.query<{ email_hash: Uint8Array; email_cifrado: Uint8Array }>(
      'SELECT email_hash, email_cifrado FROM usuarios WHERE id = $1',
      [usuario.id],
    );
    const fila = rows[0];
    expect(fila?.email_hash).toHaveLength(32);
    expect(Buffer.from(fila?.email_cifrado ?? []).includes(Buffer.from(email))).toBe(false);
  });

  it('bloquea el código al quinto fallo', async () => {
    const email = nuevoCorreo();
    await pedirCodigo(email);
    const bueno = codigoDe(email);
    for (let i = 0; i < 5; i++) {
      const fallo = await verificar(email, otroCodigo(bueno));
      expect(fallo.statusCode).toBe(400);
      expect(fallo.json().error.codigo).toBe('codigo_invalido');
    }
    expect((await verificar(email, bueno)).statusCode).toBe(400);
  });

  it('no deja reutilizar un código ni usarlo caducado', async () => {
    const email = nuevoCorreo();
    await entrar(email);
    expect((await verificar(email, codigoDe(email))).statusCode).toBe(400);

    await pedirCodigo(email);
    tiempo.avanzar(11 * MINUTO);
    expect((await verificar(email, codigoDe(email))).statusCode).toBe(400);
  });

  it('solo vale el último código pedido', async () => {
    const email = nuevoCorreo();
    await pedirCodigo(email);
    const primero = codigoDe(email);
    await pedirCodigo(email);
    const segundo = codigoDe(email);
    if (primero !== segundo) expect((await verificar(email, primero)).statusCode).toBe(400);
    expect((await verificar(email, segundo)).statusCode).toBe(200);
  });

  it('limita a cinco códigos por hora y dirección', async () => {
    const email = nuevoCorreo();
    for (let i = 0; i < 5; i++) expect((await pedirCodigo(email)).statusCode).toBe(202);
    const sexto = await pedirCodigo(email);
    expect(sexto.statusCode).toBe(429);
    expect(sexto.json().error.codigo).toBe('demasiadas_peticiones');
    tiempo.avanzar(61 * MINUTO);
    expect((await pedirCodigo(email)).statusCode).toBe(202);
  });

  it('pide sesión para la cuenta', async () => {
    expect((await app.inject({ method: 'GET', url: '/v1/yo' })).statusCode).toBe(401);
    const basura = await app.inject({ method: 'GET', url: '/v1/yo', headers: conToken('inventado') });
    expect(basura.statusCode).toBe(401);
    expect(basura.json()).toEqual({ error: { codigo: 'no_autenticado', mensaje: 'Inicia sesión para continuar.' } });
  });

  it('completa el perfil con alias, mayoría de edad y zona horaria', async () => {
    const { token } = await entrar(nuevoCorreo());
    const respuesta = await app.inject({
      method: 'PATCH',
      url: '/v1/yo',
      headers: conToken(token),
      payload: { nombreVisible: '  Laura   M. ', mayorDeEdad: true, zonaHoraria: 'Atlantic/Canary', verdeDuracionMin: 30 },
    });
    expect(respuesta.statusCode).toBe(200);
    expect(respuesta.json()).toMatchObject({
      nombreVisible: 'Laura M.',
      mayorDeEdad: true,
      zonaHoraria: 'Atlantic/Canary',
      verdeDuracionMin: 30,
      perfilCompleto: true,
    });
    const leido = await app.inject({ method: 'GET', url: '/v1/yo', headers: conToken(token) });
    expect(leido.json().nombreVisible).toBe('Laura M.');
  });

  it('rechaza cambios de perfil no válidos', async () => {
    const { token } = await entrar(nuevoCorreo());
    const invalidos = [
      { zonaHoraria: 'Marte/Olympus' },
      { verdeDuracionMin: 45 },
      { nombreVisible: '' },
      { nombreVisible: 'x'.repeat(31) },
      { nombreVisible: 'Ana​' },
      { mayorDeEdad: false },
      { campoQueNoExiste: 1 },
      {},
    ];
    for (const payload of invalidos) {
      const respuesta = await app.inject({ method: 'PATCH', url: '/v1/yo', headers: conToken(token), payload });
      expect(respuesta.statusCode, JSON.stringify(payload)).toBe(400);
      expect(respuesta.json().error.codigo).toBe('datos_invalidos');
    }
  });

  it('cierra la sesión', async () => {
    const { token } = await entrar(nuevoCorreo());
    const cierre = await app.inject({ method: 'POST', url: '/v1/auth/cerrar-sesion', headers: conToken(token) });
    expect(cierre.statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/v1/yo', headers: conToken(token) })).statusCode).toBe(401);
  });

  it('la sesión caduca tras 90 días sin uso y se renueva al usarla', async () => {
    const { token } = await entrar(nuevoCorreo());
    const yo = () => app.inject({ method: 'GET', url: '/v1/yo', headers: conToken(token) });
    tiempo.avanzar(60 * DIA);
    expect((await yo()).statusCode).toBe(200);
    tiempo.avanzar(60 * DIA);
    expect((await yo()).statusCode).toBe(200);
    tiempo.avanzar(91 * DIA);
    expect((await yo()).statusCode).toBe(401);
  });

  it('exporta los datos de la cuenta sin ningún token', async () => {
    const email = nuevoCorreo();
    const { token } = await entrar(email);
    await app.inject({ method: 'PATCH', url: '/v1/yo', headers: conToken(token), payload: { nombreVisible: 'Marta' } });
    const respuesta = await app.inject({ method: 'GET', url: '/v1/yo/exportar', headers: conToken(token) });
    expect(respuesta.statusCode).toBe(200);
    const datos = respuesta.json();
    expect(datos.cuenta).toMatchObject({ correo: email, nombreVisible: 'Marta', mayorDeEdadDeclaradaEn: null });
    expect(datos.sesiones).toHaveLength(1);
    expect(datos.sesiones[0]).toMatchObject({ dispositivo: 'iPhone', actual: true, revocadaEn: null });
    expect(respuesta.body).not.toContain(token);
  });

  it('borra la cuenta: anonimiza al momento, cierra las sesiones y deja volver a registrarse', async () => {
    const email = nuevoCorreo();
    const { token, usuario } = await entrar(email);
    const otraSesion = await entrar(email);
    await app.inject({ method: 'PATCH', url: '/v1/yo', headers: conToken(token), payload: { nombreVisible: 'Pedro' } });

    const sinConfirmar = await app.inject({ method: 'DELETE', url: '/v1/yo', headers: conToken(token) });
    expect(sinConfirmar.statusCode).toBe(400);

    const borrado = await app.inject({
      method: 'DELETE',
      url: '/v1/yo',
      headers: conToken(token),
      payload: { confirmar: true },
    });
    expect(borrado.statusCode).toBe(200);
    expect(borrado.json().borrada).toBe(true);
    expect(new Date(borrado.json().purgaDefinitivaEn).getTime()).toBe(tiempo.reloj().getTime() + 30 * DIA);

    for (const t of [token, otraSesion.token]) {
      expect((await app.inject({ method: 'GET', url: '/v1/yo', headers: conToken(t) })).statusCode).toBe(401);
    }
    const { rows } = await bd.query<Record<string, unknown>>(
      'SELECT email_hash, email_cifrado, nombre_visible, estado_cuenta FROM usuarios WHERE id = $1',
      [usuario.id],
    );
    expect(rows[0]).toEqual({ email_hash: null, email_cifrado: null, nombre_visible: null, estado_cuenta: 'ELIMINADA' });

    const deNuevo = await entrar(email);
    expect(deNuevo.nuevo).toBe(true);
    expect(deNuevo.usuario.id).not.toBe(usuario.id);
  });

  it('purga para siempre las cuentas borradas hace más de 30 días', async () => {
    const { token, usuario } = await entrar(nuevoCorreo());
    await app.inject({ method: 'DELETE', url: '/v1/yo', headers: conToken(token), payload: { confirmar: true } });
    tiempo.avanzar(29 * DIA);
    await servicio.purgarCuentasEliminadas();
    expect((await bd.query('SELECT 1 FROM usuarios WHERE id = $1', [usuario.id])).rows).toHaveLength(1);
    tiempo.avanzar(2 * DIA);
    expect(await servicio.purgarCuentasEliminadas()).toBeGreaterThanOrEqual(1);
    expect((await bd.query('SELECT 1 FROM usuarios WHERE id = $1', [usuario.id])).rows).toHaveLength(0);
    expect((await bd.query('SELECT 1 FROM sesiones WHERE usuario_id = $1', [usuario.id])).rows).toHaveLength(0);
  });

  it('no deja entrar a una cuenta suspendida', async () => {
    const email = nuevoCorreo();
    const { token, usuario } = await entrar(email);
    await bd.query("UPDATE usuarios SET estado_cuenta = 'SUSPENDIDA' WHERE id = $1", [usuario.id]);
    expect((await app.inject({ method: 'GET', url: '/v1/yo', headers: conToken(token) })).statusCode).toBe(401);
    await pedirCodigo(email);
    const intento = await verificar(email, codigoDe(email));
    expect(intento.statusCode).toBe(403);
    expect(intento.json().error.codigo).toBe('cuenta_suspendida');
  });

  it('valida las peticiones de acceso', async () => {
    const malas = [
      { url: '/v1/auth/codigo', payload: { email: 'no-es-un-correo' } },
      { url: '/v1/auth/codigo', payload: {} },
      { url: '/v1/auth/verificar', payload: { email: 'ana@ejemplo.es', codigo: '12345' } },
      { url: '/v1/auth/verificar', payload: { email: 'ana@ejemplo.es', codigo: 'abcdef' } },
    ];
    for (const { url, payload } of malas) {
      const respuesta = await app.inject({ method: 'POST', url, payload });
      expect(respuesta.statusCode, url).toBe(400);
      expect(respuesta.json().error.codigo).toBe('datos_invalidos');
    }
  });

  it('responde a /salud, pone cabeceras de seguridad y da errores con formato común', async () => {
    const salud = await app.inject({ method: 'GET', url: '/salud' });
    expect(salud.json()).toEqual({ ok: true });
    expect(salud.headers['x-content-type-options']).toBe('nosniff');

    const ruta = await app.inject({ method: 'GET', url: '/v1/no-existe' });
    expect(ruta.statusCode).toBe(404);
    expect(ruta.json().error.codigo).toBe('no_encontrado');

    const json = await app.inject({
      method: 'POST',
      url: '/v1/auth/codigo',
      headers: { 'content-type': 'application/json' },
      payload: '{roto',
    });
    expect(json.statusCode).toBe(400);
    expect(json.json().error.codigo).toBe('peticion_invalida');
  });
});
