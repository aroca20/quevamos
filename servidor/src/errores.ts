/** Error que la API devuelve tal cual: código HTTP, código estable para la app y mensaje en español. */
export class ErrorApi extends Error {
  readonly estado: number;
  readonly codigo: string;

  constructor(estado: number, codigo: string, mensaje: string) {
    super(mensaje);
    this.estado = estado;
    this.codigo = codigo;
  }
}

export const errores = {
  datosInvalidos: (detalle?: string) =>
    new ErrorApi(400, 'datos_invalidos', detalle ? `Datos no válidos: ${detalle}` : 'Los datos enviados no son válidos.'),
  codigoInvalido: () =>
    new ErrorApi(400, 'codigo_invalido', 'El código no es válido o ha caducado. Pide uno nuevo.'),
  noAutenticado: () => new ErrorApi(401, 'no_autenticado', 'Inicia sesión para continuar.'),
  cuentaSuspendida: () =>
    new ErrorApi(403, 'cuenta_suspendida', 'Esta cuenta está suspendida. Escribe a soporte.'),
  demasiadasPeticiones: () =>
    new ErrorApi(429, 'demasiadas_peticiones', 'Has pedido demasiados códigos. Espera un rato y vuelve a probar.'),
};
