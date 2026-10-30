import { z } from 'zod';

/** Claves de .env.example: solo valen para desarrollo y pruebas. */
export const CLAVES_DE_EJEMPLO: readonly string[] = [
  '06N7toQCWDr90PEm7etOKvDtmNG1GnsNzC1S4BBh+pk=',
  'oKMKoiIxtNuJf/H2CCa8TH2XGnw940ulSQU2gzqvrGI=',
];

const clave = z
  .string()
  .refine((valor) => Buffer.from(valor, 'base64').length === 32, 'debe ser una clave de 32 bytes en base64')
  .transform((valor) => Buffer.from(valor, 'base64'));

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PUERTO: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default('127.0.0.1'),
  DATABASE_URL: z.string().min(1).optional(),
  DIRECTORIO_DATOS: z.string().min(1).default('.datos'),
  CLAVE_HMAC: clave,
  CLAVE_CIFRADO: clave,
  ORIGENES_PERMITIDOS: z
    .string()
    .default('')
    .transform((valor) =>
      valor
        .split(',')
        .map((origen) => origen.trim())
        .filter(Boolean),
    ),
  CONFIAR_EN_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
});

export type Config = z.infer<typeof esquema>;

/** Lee y valida la configuración. En producción exige base de datos y claves propias. */
export function cargarConfig(entorno: Record<string, string | undefined>): Config {
  const resultado = esquema.safeParse(entorno);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuración no válida. ${detalle}`);
  }
  const config = resultado.data;
  if (config.NODE_ENV === 'production') {
    if (!config.DATABASE_URL) {
      throw new Error('En producción hace falta DATABASE_URL.');
    }
    const deEjemplo = [entorno.CLAVE_HMAC, entorno.CLAVE_CIFRADO].some(
      (valor) => valor !== undefined && CLAVES_DE_EJEMPLO.includes(valor),
    );
    if (deEjemplo) {
      throw new Error('En producción no valen las claves de .env.example: genera unas nuevas.');
    }
  }
  if (config.CLAVE_HMAC.equals(config.CLAVE_CIFRADO)) {
    throw new Error('CLAVE_HMAC y CLAVE_CIFRADO tienen que ser distintas.');
  }
  return config;
}
