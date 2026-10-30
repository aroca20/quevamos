import { describe, expect, it } from 'vitest';

import { estadoEfectivo, type EstadoDisponibilidad, type Participante } from '../src/motor';

const ahora = new Date('2026-11-02T10:00:00Z');

function persona(id: string, estadoGlobal: EstadoDisponibilidad): Participante {
  return {
    id,
    comunidades: new Set(['vecinos']),
    estadoGlobal,
    reglas: [],
    subgrupos: {},
    estadoPersonalizado: null,
    ultimaActividad: ahora,
  };
}

describe('Motor compartido con la app', () => {
  it('el servidor resuelve el estado efectivo con el mismo código', () => {
    expect(estadoEfectivo(persona('ana', 'verde'), persona('luis', 'verde'), ahora)?.nivel).toBe('verde');
  });

  it('aplica la reciprocidad de Desconocido', () => {
    expect(estadoEfectivo(persona('ana', 'verde'), persona('luis', 'desconocido'), ahora)?.nivel).toBe('desconocido');
  });
});
