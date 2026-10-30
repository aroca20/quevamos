import {
  duracionPorDefecto,
  NOMBRE_NIVEL,
  type EstadoDisponibilidad,
  type EstadoPersonalizado,
  type Nivel,
} from '../motor';

/**
 * Estado general del usuario en la pantalla «Ahora»: qué estado ha elegido, hasta cuándo
 * y su estado personalizado. Son funciones puras: reciben el estado y devuelven el nuevo.
 * De momento vive solo en el móvil; más adelante se sincronizará con el servidor.
 */
export interface Opcion {
  id: string;
  etiqueta: string;
  /** Minutos de duración; `null` si no caduca por tiempo. */
  minutos: number | null;
  hastaManana: boolean;
}

interface Instantanea {
  estado: EstadoDisponibilidad;
  hasta: Date | null;
  esReposo: boolean;
  opcionElegida: string | null;
}

export interface ModeloAhora extends Instantanea {
  /** Tu estado propio. Como mucho uno. */
  personalizado: EstadoPersonalizado | null;
  /** Lo que había antes del último cambio, para poder deshacerlo. */
  anterior: Instantanea | null;
}

/** Estado que se recupera cuando caduca una elección manual. */
export const ESTADO_DE_REPOSO: EstadoDisponibilidad = 'rojo';

export const modeloInicial: ModeloAhora = {
  estado: ESTADO_DE_REPOSO,
  hasta: null,
  esReposo: true,
  opcionElegida: null,
  personalizado: null,
  anterior: null,
};

const OPCIONES_VERDE: Opcion[] = [
  { id: '30', etiqueta: '30 min', minutos: 30, hastaManana: false },
  { id: '60', etiqueta: '1 hora', minutos: 60, hastaManana: false },
  { id: '120', etiqueta: '2 horas', minutos: 120, hastaManana: false },
];

const OPCIONES_RESTO: Opcion[] = [
  { id: '60', etiqueta: '1 hora', minutos: 60, hastaManana: false },
  { id: 'manana', etiqueta: 'Hasta mañana', minutos: null, hastaManana: true },
  { id: 'sin', etiqueta: 'Sin límite', minutos: null, hastaManana: false },
];

export function nivelDe(modelo: ModeloAhora, estado: EstadoDisponibilidad): Nivel {
  if (estado !== 'personalizado') return estado;
  return modelo.personalizado?.funcionaComo ?? 'rojo';
}

export function nombreDe(modelo: ModeloAhora, estado: EstadoDisponibilidad): string {
  if (estado !== 'personalizado') return NOMBRE_NIVEL[estado];
  return modelo.personalizado?.nombre ?? NOMBRE_NIVEL.rojo;
}

/** Las duraciones dependen del nivel: lo que funciona como Verde siempre caduca. */
export function opciones(modelo: ModeloAhora, estado: EstadoDisponibilidad): Opcion[] {
  return nivelDe(modelo, estado) === 'verde' ? OPCIONES_VERDE : OPCIONES_RESTO;
}

/** La próxima vez que el reloj marque las 8:00, para «Hasta mañana». */
export function proximasOcho(ahora: Date): Date {
  const ocho = new Date(ahora);
  ocho.setHours(8, 0, 0, 0);
  if (ocho <= ahora) ocho.setDate(ocho.getDate() + 1);
  return ocho;
}

function opcionPorDefecto(modelo: ModeloAhora, estado: EstadoDisponibilidad): string {
  const minutos = duracionPorDefecto(nivelDe(modelo, estado));
  return minutos === null ? 'sin' : String(minutos);
}

function aplicar(
  modelo: ModeloAhora,
  nuevo: EstadoDisponibilidad,
  idOpcion: string,
  guardarDeshacer: boolean,
  ahora: Date,
): ModeloAhora {
  const opcion = opciones(modelo, nuevo).find((o) => o.id === idOpcion);
  if (!opcion) return modelo;
  let hasta: Date | null = null;
  if (opcion.minutos !== null) hasta = new Date(ahora.getTime() + opcion.minutos * 60_000);
  else if (opcion.hastaManana) hasta = proximasOcho(ahora);
  return {
    ...modelo,
    estado: nuevo,
    hasta,
    esReposo: false,
    opcionElegida: opcion.id,
    anterior: guardarDeshacer
      ? { estado: modelo.estado, hasta: modelo.hasta, esReposo: modelo.esReposo, opcionElegida: modelo.opcionElegida }
      : modelo.anterior,
  };
}

/** Elige un estado con su duración por defecto. El personalizado, solo si ya lo has creado. */
export function elegir(modelo: ModeloAhora, nuevo: EstadoDisponibilidad, ahora: Date): ModeloAhora {
  if (nuevo === 'personalizado' && modelo.personalizado === null) return modelo;
  return aplicar(modelo, nuevo, opcionPorDefecto(modelo, nuevo), true, ahora);
}

/** Cambia solo la duración del estado actual. */
export function cambiarDuracion(modelo: ModeloAhora, idOpcion: string, ahora: Date): ModeloAhora {
  return aplicar(modelo, modelo.estado, idOpcion, false, ahora);
}

export function deshacer(modelo: ModeloAhora): ModeloAhora {
  if (!modelo.anterior) return modelo;
  return { ...modelo, ...modelo.anterior, anterior: null };
}

/** Vuelve al estado de reposo si la elección manual ha caducado. */
export function comprobarCaducidad(modelo: ModeloAhora, ahora: Date): ModeloAhora {
  if (!modelo.hasta || modelo.hasta > ahora) return modelo;
  return { ...modelo, estado: ESTADO_DE_REPOSO, hasta: null, esReposo: true, opcionElegida: null, anterior: null };
}

/**
 * Crea o cambia tu estado personalizado. Si lo estás usando y su duración ya no encaja
 * con el nuevo nivel (por ejemplo, pasa a funcionar como Verde), toma la de por defecto.
 */
export function guardarPersonalizado(
  modelo: ModeloAhora,
  nuevo: EstadoPersonalizado,
  ahora: Date,
): ModeloAhora {
  const actualizado: ModeloAhora = { ...modelo, personalizado: nuevo, anterior: null };
  if (actualizado.estado !== 'personalizado' || actualizado.esReposo) return actualizado;
  const encaja = opciones(actualizado, 'personalizado').some((o) => o.id === actualizado.opcionElegida);
  if (encaja) return actualizado;
  return aplicar(actualizado, 'personalizado', opcionPorDefecto(actualizado, 'personalizado'), false, ahora);
}

/**
 * Borra tu estado personalizado. Si lo estabas usando, pasas al color con el que funcionaba,
 * con la misma duración: el nivel no cambia, así que las opciones siguen siendo válidas.
 */
export function borrarPersonalizado(modelo: ModeloAhora): ModeloAhora {
  if (!modelo.personalizado) return modelo;
  const estado = modelo.estado === 'personalizado' ? modelo.personalizado.funcionaComo : modelo.estado;
  return { ...modelo, estado, personalizado: null, anterior: null };
}
