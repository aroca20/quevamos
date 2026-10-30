import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { errores } from '../../errores';
import type { ServicioCuentas, Sesion } from './servicio';

declare module 'fastify' {
  interface FastifyRequest {
    sesion: Sesion | null;
  }
}

export interface LimitesHttpCuentas {
  /** Peticiones de código por minuto y por IP. */
  codigoPorMinuto: number;
  /** Intentos de verificación por minuto y por IP. */
  verificarPorMinuto: number;
}

const sinCaracteresDeControl = (texto: string) => !/[\p{Cc}\p{Cf}]/u.test(texto);

function esZonaHoraria(zona: string): boolean {
  try {
    new Intl.DateTimeFormat('es', { timeZone: zona });
    return true;
  } catch {
    return false;
  }
}

const correo = z.string().trim().max(254).pipe(z.email());

const esquemas = {
  solicitarCodigo: z.object({ email: correo }),
  verificarCodigo: z.object({
    email: correo,
    codigo: z.string().regex(/^\d{6}$/, 'el código tiene seis cifras'),
    dispositivo: z.string().trim().min(1).max(60).refine(sinCaracteresDeControl).optional(),
  }),
  perfil: z
    .strictObject({
      nombreVisible: z
        .string()
        .trim()
        .min(1)
        .max(30)
        .refine(sinCaracteresDeControl, 'el alias tiene caracteres no permitidos')
        .transform((alias) => alias.replace(/\s+/g, ' '))
        .optional(),
      mayorDeEdad: z.literal(true).optional(),
      zonaHoraria: z.string().max(64).refine(esZonaHoraria, 'zona horaria desconocida').optional(),
      verdeDuracionMin: z.union([z.literal(30), z.literal(60), z.literal(120)]).optional(),
    })
    .refine((cambios) => Object.keys(cambios).length > 0, 'no hay nada que cambiar'),
  borrarCuenta: z.object({ confirmar: z.literal(true) }),
};

function validar<T>(esquema: z.ZodType<T>, datos: unknown): T {
  const resultado = esquema.safeParse(datos ?? {});
  if (!resultado.success) {
    const problema = resultado.error.issues[0];
    const campo = problema?.path.join('.');
    throw errores.datosInvalidos(problema ? (campo ? `${campo}: ${problema.message}` : problema.message) : undefined);
  }
  return resultado.data;
}

/** Rutas de acceso y de la propia cuenta, bajo /v1. */
export async function rutasCuentas(
  app: FastifyInstance,
  opciones: { servicio: ServicioCuentas; limites: LimitesHttpCuentas },
): Promise<void> {
  const { servicio, limites } = opciones;
  app.decorateRequest('sesion', null);

  async function requiereSesion(request: FastifyRequest): Promise<void> {
    const [tipo, token] = (request.headers.authorization ?? '').split(' ');
    const sesion = tipo === 'Bearer' && token ? await servicio.autenticar(token) : null;
    if (!sesion) throw errores.noAutenticado();
    request.sesion = sesion;
  }

  function sesionDe(request: FastifyRequest): Sesion {
    if (!request.sesion) throw errores.noAutenticado();
    return request.sesion;
  }

  app.post(
    '/auth/codigo',
    { config: { rateLimit: { max: limites.codigoPorMinuto, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { email } = validar(esquemas.solicitarCodigo, request.body);
      await servicio.solicitarCodigo(email);
      return reply.code(202).send({ enviado: true });
    },
  );

  app.post(
    '/auth/verificar',
    { config: { rateLimit: { max: limites.verificarPorMinuto, timeWindow: '1 minute' } } },
    async (request) => {
      const { email, codigo, dispositivo } = validar(esquemas.verificarCodigo, request.body);
      return servicio.verificarCodigo(email, codigo, dispositivo);
    },
  );

  app.post('/auth/cerrar-sesion', { preHandler: requiereSesion }, async (request, reply) => {
    await servicio.cerrarSesion(sesionDe(request).sesionId);
    return reply.code(204).send();
  });

  app.get('/yo', { preHandler: requiereSesion }, async (request) => servicio.perfil(sesionDe(request).usuarioId));

  app.patch('/yo', { preHandler: requiereSesion }, async (request) => {
    const cambios = validar(esquemas.perfil, request.body);
    return servicio.actualizarPerfil(sesionDe(request).usuarioId, cambios);
  });

  app.get('/yo/exportar', { preHandler: requiereSesion }, async (request) => {
    const sesion = sesionDe(request);
    return servicio.exportar(sesion.usuarioId, sesion.sesionId);
  });

  app.delete('/yo', { preHandler: requiereSesion }, async (request) => {
    validar(esquemas.borrarCuenta, request.body);
    const { purgaDefinitivaEn } = await servicio.borrarCuenta(sesionDe(request).usuarioId);
    return { borrada: true, purgaDefinitivaEn };
  });
}
