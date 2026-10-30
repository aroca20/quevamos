import type { EstadoDisponibilidad, EstadoPersonalizado, Nivel } from './estados';
import { NOMBRE_NIVEL } from './estados';

/** A quién se aplica una regla de color. */
export type Alcance =
  | { tipo: 'comunidad'; id: string }
  | { tipo: 'subgrupo'; id: string }
  | { tipo: 'persona'; id: string };

/** Cuanto menor, más específica: persona, luego subgrupo, luego comunidad. */
export function especificidad(alcance: Alcance): number {
  switch (alcance.tipo) {
    case 'persona':
      return 0;
    case 'subgrupo':
      return 1;
    case 'comunidad':
      return 2;
  }
}

/** Una regla de color: «a este alcance, muéstrale este estado». */
export interface Regla {
  estado: EstadoDisponibilidad;
  alcance: Alcance;
  /** Si es prioritaria, atraviesa el techo del estado general. */
  prioritaria?: boolean;
  desde?: Date | null;
  hasta?: Date | null;
}

/** Indica si la regla está en vigor en el instante `t`. */
export function vigente(regla: Regla, t: Date): boolean {
  if (regla.desde && t < regla.desde) return false;
  if (regla.hasta && t >= regla.hasta) return false;
  return true;
}

/** Lo que el motor necesita saber de cada persona para decidir qué estado muestra. */
export interface Participante {
  id: string;
  comunidades: ReadonlySet<string>;
  /** Estado general ya resuelto: manual, si no automático, si no el de reposo. */
  estadoGlobal: EstadoDisponibilidad;
  reglas: readonly Regla[];
  /** Listas propias de esta persona: identificador del subgrupo y sus miembros. */
  subgrupos: Readonly<Record<string, ReadonlySet<string>>>;
  /** Su estado propio, si lo ha creado. Las reglas y el estado general pueden usarlo. */
  estadoPersonalizado: EstadoPersonalizado | null;
  ultimaActividad: Date;
}

/**
 * Nivel con el que funciona uno de los estados de una persona.
 * Si apunta a un personalizado que ya no existe, cuenta como Rojo: ante la duda, no molestar.
 */
export function nivelDe(persona: Participante, estado: EstadoDisponibilidad): Nivel {
  if (estado !== 'personalizado') return estado;
  return persona.estadoPersonalizado?.funcionaComo ?? 'rojo';
}

/** Nombre con el que los demás ven uno de sus estados. */
export function nombreDe(persona: Participante, estado: EstadoDisponibilidad): string {
  if (estado !== 'personalizado') return NOMBRE_NIVEL[estado];
  return persona.estadoPersonalizado?.nombre ?? NOMBRE_NIVEL.rojo;
}
