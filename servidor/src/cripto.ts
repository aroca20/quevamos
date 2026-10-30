import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

/** UUID versión 7: los primeros 48 bits son la hora en milisegundos, así que se ordenan por fecha. */
export function uuidv7(ahora: number = Date.now()): string {
  const bytes = randomBytes(16);
  let tiempo = ahora;
  for (let i = 5; i >= 0; i--) {
    bytes[i] = tiempo % 256;
    tiempo = Math.floor(tiempo / 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Misma dirección, mismo resultado: sin espacios, en minúsculas y con Unicode normalizado. */
export function normalizarEmail(email: string): string {
  return email.normalize('NFKC').trim().toLowerCase();
}

export function hmac(clave: Buffer, texto: string): Buffer {
  return createHmac('sha256', clave).update(texto, 'utf8').digest();
}

const LONGITUD_IV = 12;
const LONGITUD_ETIQUETA = 16;

/** AES-256-GCM. El resultado lleva el vector inicial y la etiqueta de autenticación delante. */
export function cifrar(clave: Buffer, texto: string): Buffer {
  const iv = randomBytes(LONGITUD_IV);
  const cifrador = createCipheriv('aes-256-gcm', clave, iv);
  const datos = Buffer.concat([cifrador.update(texto, 'utf8'), cifrador.final()]);
  return Buffer.concat([iv, cifrador.getAuthTag(), datos]);
}

/** Lanza un error si el paquete se ha alterado o la clave no es la correcta. */
export function descifrar(clave: Buffer, paquete: Uint8Array): string {
  const datos = Buffer.from(paquete);
  const descifrador = createDecipheriv('aes-256-gcm', clave, datos.subarray(0, LONGITUD_IV));
  descifrador.setAuthTag(datos.subarray(LONGITUD_IV, LONGITUD_IV + LONGITUD_ETIQUETA));
  return Buffer.concat([
    descifrador.update(datos.subarray(LONGITUD_IV + LONGITUD_ETIQUETA)),
    descifrador.final(),
  ]).toString('utf8');
}

/** Código de acceso de seis cifras, con generador criptográfico. */
export function generarCodigo(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Token de sesión: 256 bits aleatorios. */
export function generarToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

/** Comparación en tiempo constante, para no dar pistas por lo que tarda. */
export function igualesSeguro(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}
