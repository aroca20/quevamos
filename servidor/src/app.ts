import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import { z } from 'zod';

import { ErrorApi } from './errores';
import { type LimitesHttpCuentas, rutasCuentas } from './modulos/cuentas/rutas';
import type { ServicioCuentas } from './modulos/cuentas/servicio';

// Mensajes de validación en español.
z.config(z.locales.es());

export interface LimitesHttp extends LimitesHttpCuentas {
  /** Peticiones por minuto y por IP en el resto de rutas. */
  generalPorMinuto: number;
}

export const LIMITES_HTTP: LimitesHttp = {
  generalPorMinuto: 120,
  codigoPorMinuto: 5,
  verificarPorMinuto: 10,
};

export interface DependenciasApp {
  servicio: ServicioCuentas;
  entorno: 'development' | 'test' | 'production';
  /** Orígenes de navegador que pueden llamar a la API. La app móvil no los necesita. */
  origenes?: string[];
  /** Solo detrás del proxy del proveedor: así los límites por IP usan la IP real. */
  confiarEnProxy?: boolean;
  limites?: Partial<LimitesHttp>;
}

const cuerpoError = (codigo: string, mensaje: string) => ({ error: { codigo, mensaje } });

export async function construirApp(deps: DependenciasApp): Promise<FastifyInstance> {
  const limites = { ...LIMITES_HTTP, ...deps.limites };
  const app = Fastify({
    logger:
      deps.entorno === 'test'
        ? false
        : {
            level: 'info',
            redact: ['req.headers.authorization'],
            ...(deps.entorno === 'development' ? { transport: { target: 'pino-pretty' } } : {}),
          },
    trustProxy: deps.confiarEnProxy ?? false,
    bodyLimit: 16 * 1024,
  });

  app.setErrorHandler((error: FastifyError | ErrorApi, request, reply) => {
    if (error instanceof ErrorApi) {
      return reply.code(error.estado).send(cuerpoError(error.codigo, error.message));
    }
    const estado = error.statusCode ?? 500;
    if (estado === 429) {
      return reply
        .code(429)
        .send(cuerpoError('demasiadas_peticiones', 'Demasiadas peticiones. Espera un minuto y vuelve a probar.'));
    }
    if (estado >= 400 && estado < 500) {
      return reply.code(estado).send(cuerpoError('peticion_invalida', 'La petición no es válida.'));
    }
    request.log.error(error);
    return reply.code(500).send(cuerpoError('error_interno', 'Algo ha fallado en el servidor.'));
  });

  app.setNotFoundHandler((_request, reply) => reply.code(404).send(cuerpoError('no_encontrado', 'Esa ruta no existe.')));

  await app.register(helmet);
  if (deps.origenes && deps.origenes.length > 0) {
    await app.register(cors, { origin: deps.origenes, methods: ['GET', 'POST', 'PATCH', 'DELETE'] });
  }
  await app.register(rateLimit, { max: limites.generalPorMinuto, timeWindow: '1 minute' });

  app.get('/salud', async () => ({ ok: true }));
  await app.register(rutasCuentas, { prefix: '/v1', servicio: deps.servicio, limites });

  return app;
}
