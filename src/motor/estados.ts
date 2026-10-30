/**
 * Lo que permite un estado, de más a menos restrictivo.
 *
 * El orden importa: cuando dos reglas chocan gana la más restrictiva, y el estado
 * general actúa como techo. Desconocido es el más restrictivo porque no revela nada.
 * El chat, los avisos y la proximidad se deciden siempre por el nivel, nunca por el nombre.
 */
export type Nivel = 'desconocido' | 'rojo' | 'amarillo' | 'verde';

const ORDEN: Record<Nivel, number> = { desconocido: 0, rojo: 1, amarillo: 2, verde: 3 };

/** Negativo si `a` es más restrictivo que `b`, cero si son iguales, positivo si es menos. */
export function compararNiveles(a: Nivel, b: Nivel): number {
  return ORDEN[a] - ORDEN[b];
}

/** El más restrictivo de una lista de niveles. */
export function nivelMinimo(niveles: readonly Nivel[]): Nivel {
  return niveles.reduce((menor, n) => (compararNiveles(n, menor) < 0 ? n : menor));
}

/** Color del semáforo que corresponde a cada nivel. */
export const NOMBRE_NIVEL: Record<Nivel, string> = {
  verde: 'Verde',
  amarillo: 'Amarillo',
  rojo: 'Rojo',
  desconocido: 'Desconocido',
};

/** Qué significa cada nivel para quien lo ve. */
export const SIGNIFICADO: Record<Nivel, string> = {
  verde: 'Disponible',
  amarillo: 'Depende',
  rojo: 'No molestar',
  desconocido: 'No muestra su estado',
};

/**
 * Duración por defecto, en minutos, cuando se elige a mano; `null` significa sin límite.
 * Lo que funciona como Verde siempre caduca: un estado abierto olvidado molesta más que uno cerrado.
 */
export function duracionPorDefecto(nivel: Nivel): number | null {
  return nivel === 'verde' ? 60 : null;
}

/** Los estados que se pueden elegir: los cuatro fijos y el personalizado de cada persona. */
export type EstadoDisponibilidad = Nivel | 'personalizado';

/** Los niveles con los que puede funcionar un estado personalizado: nunca Desconocido. */
export type NivelVisible = Exclude<Nivel, 'desconocido'>;

/**
 * Paleta cerrada del estado personalizado. Ningún color se parece al verde, al ámbar,
 * al rojo ni al gris del semáforo, y todos alcanzan el contraste de 3:1 con su borde.
 */
export type ColorPersonalizado = 'cielo' | 'anil' | 'lavanda' | 'orquidea' | 'rosa';

export const COLORES: readonly ColorPersonalizado[] = ['cielo', 'anil', 'lavanda', 'orquidea', 'rosa'];

export const NOMBRE_COLOR: Record<ColorPersonalizado, string> = {
  cielo: 'Cielo',
  anil: 'Añil',
  lavanda: 'Lavanda',
  orquidea: 'Orquídea',
  rosa: 'Rosa',
};

/**
 * El estado propio de una persona: nombre y color a su gusto, y funciona como un color del semáforo.
 * Cada persona tiene como máximo uno. El nombre lo ven sus comunidades, así que el servidor
 * lo revisará con el mismo filtro que los mensajes antes de aceptarlo.
 */
export interface EstadoPersonalizado {
  readonly nombre: string;
  readonly color: ColorPersonalizado;
  readonly funcionaComo: NivelVisible;
}

export const LONGITUD_MAXIMA = 16;

const RESERVADOS = new Set([
  'verde',
  'amarillo',
  'rojo',
  'desconocido',
  'disponible',
  'depende',
  'no molestar',
]);

const SIN_TILDE: Record<string, string> = {
  á: 'a', à: 'a', ä: 'a', â: 'a',
  é: 'e', è: 'e', ë: 'e', ê: 'e',
  í: 'i', ì: 'i', ï: 'i', î: 'i',
  ó: 'o', ò: 'o', ö: 'o', ô: 'o',
  ú: 'u', ù: 'u', ü: 'u', û: 'u',
};

/** Quita los espacios sobrantes: «  En   clase » pasa a «En clase». */
export function limpiarNombre(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).join(' ');
}

/** Nombres que se confundirían con el semáforo, sin distinguir mayúsculas ni tildes. */
export function esNombreReservado(nombre: string): boolean {
  const normalizado = Array.from(limpiarNombre(nombre).toLowerCase())
    .map((letra) => SIN_TILDE[letra] ?? letra)
    .join('');
  return RESERVADOS.has(normalizado);
}

/**
 * Crea un estado personalizado. Devuelve `null` si el nombre está vacío, pasa de 16 caracteres
 * o copia el de un estado fijo, o si se pide que funcione como Desconocido.
 */
export function crearEstadoPersonalizado(
  nombre: string,
  color: ColorPersonalizado,
  funcionaComo: Nivel,
): EstadoPersonalizado | null {
  const limpio = limpiarNombre(nombre);
  if (
    limpio.length === 0 ||
    Array.from(limpio).length > LONGITUD_MAXIMA ||
    esNombreReservado(limpio) ||
    funcionaComo === 'desconocido'
  ) {
    return null;
  }
  return { nombre: limpio, color, funcionaComo };
}
