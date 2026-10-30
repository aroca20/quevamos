/** Envío de los códigos de acceso. En producción irá un proveedor de correo con servidores en la UE. */
export interface Correo {
  enviarCodigo(destino: string, codigo: string): Promise<void>;
}

/** Desarrollo: el código aparece en la consola del servidor y no se envía ningún correo. */
export class CorreoConsola implements Correo {
  private readonly escribir: (linea: string) => void;

  constructor(escribir: (linea: string) => void = console.log) {
    this.escribir = escribir;
  }

  async enviarCodigo(destino: string, codigo: string): Promise<void> {
    this.escribir(`[desarrollo] Código de acceso para ${destino}: ${codigo}`);
  }
}

/** Pruebas: guarda los códigos en memoria. */
export class CorreoMemoria implements Correo {
  readonly enviados: { destino: string; codigo: string }[] = [];

  async enviarCodigo(destino: string, codigo: string): Promise<void> {
    this.enviados.push({ destino, codigo });
  }

  ultimoCodigo(destino: string): string | undefined {
    return this.enviados.filter((envio) => envio.destino === destino).at(-1)?.codigo;
  }
}
