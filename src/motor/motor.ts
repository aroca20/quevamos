import type { EstadoDisponibilidad, Nivel } from './estados';
import { compararNiveles, nivelMinimo } from './estados';
import type { Alcance, Participante, Regla } from './reglas';
import { especificidad, nivelDe, vigente } from './reglas';

/** Por qué una persona ve un estado concreto. Alimenta el simulador «Cómo me ven». */
export type Motivo =
  | { tipo: 'bloqueo' }
  | { tipo: 'inactividad' }
  | { tipo: 'reciprocidad' }
  | { tipo: 'estadoGeneral' }
  | { tipo: 'regla'; alcance: Alcance; prioritaria: boolean; limitadaPorEstadoGeneral: boolean };

/** Resultado de resolver lo que una persona ve de otra. */
export interface Resolucion {
  /** Estado que se muestra. Si es `personalizado`, es el de quien lo muestra. */
  estado: EstadoDisponibilidad;
  /** Lo que permite ese estado: decide el chat, los avisos y la proximidad. */
  nivel: Nivel;
  motivo: Motivo;
}

/** Estado del canal de chat entre dos personas. */
export type Canal = 'abierto' | 'enPausa' | 'cerrado' | 'bloqueado';

/** Lo que una persona puede hacer hacia otra según el nivel de ambas. */
export type Accion =
  | 'escribir'
  | 'proponerEncuentro'
  | 'ponermeEnVerde'
  | 'aviso'
  | 'avisameCuandoPodamos'
  | 'mostrarleMiEstado';

export interface Opciones {
  bloqueado?: boolean;
  diasInactividad?: number;
}

const DIA_MS = 86_400_000;

function desconocido(motivo: Motivo): Resolucion {
  return { estado: 'desconocido', nivel: 'desconocido', motivo };
}

function interseccion(a: ReadonlySet<string>, b: ReadonlySet<string>): Set<string> {
  return new Set([...a].filter((x) => b.has(x)));
}

function estaInactivo(persona: Participante, t: Date, dias: number): boolean {
  return t.getTime() - persona.ultimaActividad.getTime() > dias * DIA_MS;
}

function aplica(regla: Regla, origen: Participante, destino: Participante, compartidas: Set<string>): boolean {
  switch (regla.alcance.tipo) {
    case 'persona':
      return regla.alcance.id === destino.id;
    case 'subgrupo':
      return origen.subgrupos[regla.alcance.id]?.has(destino.id) ?? false;
    case 'comunidad':
      return compartidas.has(regla.alcance.id);
  }
}

/**
 * Lo que `a` muestra a `b` antes de aplicar la reciprocidad.
 * Gana el alcance más específico que tenga alguna regla: persona, subgrupo, comunidad.
 */
export function estadoPropio(
  a: Participante,
  b: Participante,
  compartidas: Set<string>,
  t: Date,
): Resolucion {
  const vigentes = a.reglas.filter((r) => vigente(r, t));
  const general = a.estadoGlobal;
  const nivelGeneral = nivelDe(a, general);
  for (let nivelDeAlcance = 0; nivelDeAlcance <= 2; nivelDeAlcance++) {
    const aplicables = vigentes.filter(
      (r) => especificidad(r.alcance) === nivelDeAlcance && aplica(r, a, b, compartidas),
    );
    if (aplicables.length === 0) continue;
    const minimo = nivelMinimo(aplicables.map((r) => nivelDe(a, r.estado)));
    const ganadoras = aplicables.filter((r) => nivelDe(a, r.estado) === minimo);
    // A igual nivel se muestra el personalizado: permite lo mismo y da más contexto.
    const elegida = ganadoras.find((r) => r.estado === 'personalizado') ?? ganadoras[0];
    if (ganadoras.every((r) => r.prioritaria === true)) {
      return {
        estado: elegida.estado,
        nivel: minimo,
        motivo: { tipo: 'regla', alcance: elegida.alcance, prioritaria: true, limitadaPorEstadoGeneral: false },
      };
    }
    // El estado general actúa como techo de las reglas no prioritarias.
    // Si empatan en nivel, se queda la regla: es la elección más concreta.
    if (compararNiveles(nivelGeneral, minimo) < 0) {
      return {
        estado: general,
        nivel: nivelGeneral,
        motivo: { tipo: 'regla', alcance: elegida.alcance, prioritaria: false, limitadaPorEstadoGeneral: true },
      };
    }
    return {
      estado: elegida.estado,
      nivel: minimo,
      motivo: { tipo: 'regla', alcance: elegida.alcance, prioritaria: false, limitadaPorEstadoGeneral: false },
    };
  }
  return { estado: general, nivel: nivelGeneral, motivo: { tipo: 'estadoGeneral' } };
}

/** Lo que `b` ve de `a` en el instante `t`, o `null` si no comparten ninguna comunidad. */
export function estadoEfectivo(
  a: Participante,
  b: Participante,
  t: Date,
  { bloqueado = false, diasInactividad = 7 }: Opciones = {},
): Resolucion | null {
  if (bloqueado) return desconocido({ tipo: 'bloqueo' });
  const compartidas = interseccion(a.comunidades, b.comunidades);
  if (compartidas.size === 0) return null;
  if (estaInactivo(a, t, diasInactividad)) return desconocido({ tipo: 'inactividad' });
  const deA = estadoPropio(a, b, compartidas, t);
  if (deA.nivel === 'desconocido') return deA;
  // Reciprocidad: si `b` muestra Desconocido a `a`, tampoco ve el estado de `a`.
  const deB = estadoPropio(b, a, compartidas, t);
  if (deB.nivel === 'desconocido') return desconocido({ tipo: 'reciprocidad' });
  return deA;
}

/** Canal de chat entre `a` y `b`, o `null` si no comparten ninguna comunidad. */
export function canal(a: Participante, b: Participante, t: Date, opciones: Opciones = {}): Canal | null {
  if (opciones.bloqueado) return 'bloqueado';
  const deA = estadoEfectivo(a, b, t, opciones)?.nivel;
  const deB = estadoEfectivo(b, a, t, opciones)?.nivel;
  if (deA === undefined || deB === undefined) return null;
  if (deA === 'verde' && deB === 'verde') return 'abierto';
  if (compararNiveles(deA, 'rojo') <= 0 || compararNiveles(deB, 'rojo') <= 0) return 'cerrado';
  return 'enPausa';
}

/**
 * Los avisos de proximidad solo se calculan con Verde mutuo, también cuando alguien usa
 * un estado personalizado que funciona como Verde. La distancia se comprueba aparte.
 */
export function proximidadPermitida(a: Participante, b: Participante, t: Date, opciones: Opciones = {}): boolean {
  return canal(a, b, t, opciones) === 'abierto';
}

/** Lo que `yo` puedo hacer hacia `otra` persona. */
export function acciones(yo: Participante, otra: Participante, t: Date, opciones: Opciones = {}): Set<Accion> {
  if (opciones.bloqueado) return new Set();
  const mio = estadoEfectivo(yo, otra, t, opciones)?.nivel;
  const suyo = estadoEfectivo(otra, yo, t, opciones)?.nivel;
  if (mio === undefined || suyo === undefined) return new Set();
  if (mio === 'verde' && suyo === 'verde') return new Set(['escribir', 'proponerEncuentro']);
  switch (suyo) {
    case 'verde':
      return new Set(['ponermeEnVerde']);
    case 'amarillo':
      // Para avisar a alguien hay que estar al menos en Amarillo para esa persona.
      return compararNiveles(mio, 'amarillo') >= 0
        ? new Set(['aviso', 'avisameCuandoPodamos'])
        : new Set(['ponermeEnVerde', 'avisameCuandoPodamos']);
    case 'rojo':
      return new Set(['avisameCuandoPodamos']);
    case 'desconocido': {
      const compartidas = interseccion(yo.comunidades, otra.comunidades);
      const propio = estadoPropio(yo, otra, compartidas, t);
      return propio.nivel === 'desconocido' ? new Set(['mostrarleMiEstado']) : new Set();
    }
  }
}
