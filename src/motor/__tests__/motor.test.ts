import {
  acciones,
  canal,
  crearEstadoPersonalizado,
  estadoEfectivo,
  nombreDe,
  proximidadPermitida,
  type EstadoDisponibilidad,
  type EstadoPersonalizado,
  type Nivel,
  type NivelVisible,
  type Participante,
  type Resolucion,
} from '..';

/** Escenario de la especificación: Laura, su estado «Entrenando» y sus reglas. */
const AHORA = new Date(1_800_000_000_000);
const DIA_MS = 86_400_000;

function entrenando(funcionaComo: NivelVisible = 'amarillo'): EstadoPersonalizado {
  const estado = crearEstadoPersonalizado('Entrenando', 'lavanda', funcionaComo);
  if (!estado) throw new Error('«Entrenando» debería ser un nombre válido');
  return estado;
}

function laura(estadoGlobal: EstadoDisponibilidad = 'verde'): Participante {
  return {
    id: 'laura',
    comunidades: new Set(['vecinos', 'trabajo', 'running', 'coro']),
    estadoGlobal,
    reglas: [
      { estado: 'rojo', alcance: { tipo: 'comunidad', id: 'trabajo' } },
      { estado: 'verde', alcance: { tipo: 'comunidad', id: 'vecinos' } },
      { estado: 'personalizado', alcance: { tipo: 'comunidad', id: 'running' } },
      { estado: 'verde', alcance: { tipo: 'subgrupo', id: 'intimos' }, prioritaria: true },
      { estado: 'desconocido', alcance: { tipo: 'persona', id: 'pedro' } },
    ],
    subgrupos: { intimos: new Set(['marta']) },
    estadoPersonalizado: entrenando(),
    ultimaActividad: AHORA,
  };
}

function persona(id: string, comunidades: string[]): Participante {
  return {
    id,
    comunidades: new Set(comunidades),
    estadoGlobal: 'verde',
    reglas: [],
    subgrupos: {},
    estadoPersonalizado: null,
    ultimaActividad: AHORA,
  };
}

/** Lo que `observador` ve de `laura`. */
function ve(de: Participante, observador: Participante): Resolucion | null {
  return estadoEfectivo(de, observador, AHORA);
}

describe('Estado efectivo', () => {
  test('cada persona ve el estado de la regla más específica', () => {
    const esperado: [string, string[], EstadoDisponibilidad, Nivel][] = [
      ['juan', ['vecinos'], 'verde', 'verde'],
      ['carmen', ['vecinos', 'trabajo'], 'rojo', 'rojo'],
      ['marta', ['trabajo'], 'verde', 'verde'],
      ['ana', ['running'], 'personalizado', 'amarillo'],
      ['pedro', ['vecinos'], 'desconocido', 'desconocido'],
      ['rosa', ['coro'], 'verde', 'verde'],
    ];
    for (const [id, comunidades, estado, nivel] of esperado) {
      const resultado = ve(laura(), persona(id, comunidades));
      expect({ id, estado: resultado?.estado, nivel: resultado?.nivel }).toEqual({ id, estado, nivel });
    }
  });

  test('con Rojo general solo atraviesan las reglas prioritarias', () => {
    const esperado: [string, string[], EstadoDisponibilidad][] = [
      ['juan', ['vecinos'], 'rojo'],
      ['carmen', ['vecinos', 'trabajo'], 'rojo'],
      ['marta', ['trabajo'], 'verde'],
      ['ana', ['running'], 'rojo'],
      ['pedro', ['vecinos'], 'desconocido'],
      ['rosa', ['coro'], 'rojo'],
    ];
    for (const [id, comunidades, estado] of esperado) {
      expect({ id, estado: ve(laura('rojo'), persona(id, comunidades))?.estado }).toEqual({ id, estado });
    }
  });

  test('Desconocido es recíproco', () => {
    const pedro = persona('pedro', ['vecinos']);
    expect(ve(laura(), pedro)?.estado).toBe('desconocido');
    expect(ve(pedro, laura())).toEqual({ estado: 'desconocido', nivel: 'desconocido', motivo: { tipo: 'reciprocidad' } });
  });

  test('sin comunidad en común no hay relación', () => {
    expect(ve(laura(), persona('eva', ['ajedrez']))).toBeNull();
  });

  test('tras siete días sin uso se ve Desconocido', () => {
    const inactiva = { ...laura(), ultimaActividad: new Date(AHORA.getTime() - 8 * DIA_MS) };
    expect(ve(inactiva, persona('juan', ['vecinos']))).toEqual({
      estado: 'desconocido',
      nivel: 'desconocido',
      motivo: { tipo: 'inactividad' },
    });
  });

  test('un bloqueo se ve igual que Desconocido', () => {
    const juan = persona('juan', ['vecinos']);
    expect(estadoEfectivo(laura(), juan, AHORA, { bloqueado: true })?.estado).toBe('desconocido');
    expect(canal(laura(), juan, AHORA, { bloqueado: true })).toBe('bloqueado');
  });

  test('una regla caducada deja de aplicarse', () => {
    const base = laura('rojo');
    const conExcepcion: Participante = {
      ...base,
      reglas: [
        ...base.reglas,
        {
          estado: 'verde',
          alcance: { tipo: 'persona', id: 'juan' },
          prioritaria: true,
          hasta: new Date(AHORA.getTime() - 60_000),
        },
      ],
    };
    expect(ve(conExcepcion, persona('juan', ['vecinos']))?.estado).toBe('rojo');
  });
});

describe('Estado personalizado', () => {
  test('se ve con su nombre y funciona como su color', () => {
    const ana = persona('ana', ['running']);
    expect(nombreDe(laura(), 'personalizado')).toBe('Entrenando');
    expect(canal(laura(), ana, AHORA)).toBe('enPausa');
    expect(acciones(ana, laura(), AHORA)).toEqual(new Set(['aviso', 'avisameCuandoPodamos']));
    expect(acciones(laura(), ana, AHORA)).toEqual(new Set(['ponermeEnVerde']));
  });

  test('si funciona como Verde, abre el chat y la proximidad', () => {
    const comoVerde = { ...laura(), estadoPersonalizado: entrenando('verde') };
    const ana = persona('ana', ['running']);
    expect(canal(comoVerde, ana, AHORA)).toBe('abierto');
    expect(proximidadPermitida(comoVerde, ana, AHORA)).toBe(true);
  });

  test('entre reglas del mismo nivel se muestra el personalizado', () => {
    const comoVerde = { ...laura(), estadoPersonalizado: entrenando('verde') };
    const juan = persona('juan', ['vecinos', 'running']);
    expect(ve(comoVerde, juan)?.estado).toBe('personalizado');
    expect(ve(comoVerde, juan)?.nivel).toBe('verde');
  });

  test('como estado general, pone techo a las reglas', () => {
    const general: Participante = {
      ...laura('personalizado'),
      reglas: [{ estado: 'verde', alcance: { tipo: 'comunidad', id: 'vecinos' } }],
    };
    expect(ve(general, persona('juan', ['vecinos']))).toEqual({
      estado: 'personalizado',
      nivel: 'amarillo',
      motivo: {
        tipo: 'regla',
        alcance: { tipo: 'comunidad', id: 'vecinos' },
        prioritaria: false,
        limitadaPorEstadoGeneral: true,
      },
    });
    expect(ve(general, persona('rosa', ['coro']))).toEqual({
      estado: 'personalizado',
      nivel: 'amarillo',
      motivo: { tipo: 'estadoGeneral' },
    });
  });

  test('si el techo tiene el mismo nivel que la regla, se ve la regla', () => {
    const general: Participante = {
      ...laura('personalizado'),
      estadoPersonalizado: entrenando('verde'),
      reglas: [{ estado: 'verde', alcance: { tipo: 'comunidad', id: 'vecinos' } }],
    };
    expect(ve(general, persona('juan', ['vecinos']))?.estado).toBe('verde');
    expect(ve(general, persona('rosa', ['coro']))?.estado).toBe('personalizado');
  });

  test('una regla que apunta a un personalizado borrado cuenta como Rojo', () => {
    const sinPersonalizado = { ...laura(), estadoPersonalizado: null };
    expect(ve(sinPersonalizado, persona('ana', ['running']))?.nivel).toBe('rojo');
    expect(nombreDe(sinPersonalizado, 'personalizado')).toBe('Rojo');
  });

  test('el nombre se limpia y no puede copiar el semáforo', () => {
    expect(crearEstadoPersonalizado('  En   clase ', 'cielo', 'rojo')?.nombre).toBe('En clase');
    expect(crearEstadoPersonalizado('   ', 'cielo', 'rojo')).toBeNull();
    expect(crearEstadoPersonalizado('Diecisiete letras', 'cielo', 'rojo')).toBeNull();
    expect(crearEstadoPersonalizado('Vérde', 'cielo', 'rojo')).toBeNull();
    expect(crearEstadoPersonalizado('no MOLESTAR', 'cielo', 'rojo')).toBeNull();
    expect(crearEstadoPersonalizado('Oculto', 'cielo', 'desconocido')).toBeNull();
  });
});

describe('Canal y acciones', () => {
  test('Verde mutuo abre el chat', () => {
    const juan = persona('juan', ['vecinos']);
    expect(canal(laura(), juan, AHORA)).toBe('abierto');
    expect(acciones(juan, laura(), AHORA)).toEqual(new Set(['escribir', 'proponerEncuentro']));
  });

  test('hacia alguien en Amarillo caben avisos breves', () => {
    const enAmarillo: Participante = { ...laura('amarillo'), reglas: [] };
    const juan = persona('juan', ['vecinos']);
    expect(canal(enAmarillo, juan, AHORA)).toBe('enPausa');
    expect(acciones(juan, enAmarillo, AHORA)).toEqual(new Set(['aviso', 'avisameCuandoPodamos']));
  });

  test('Rojo o Desconocido cierran el chat', () => {
    const juan = persona('juan', ['vecinos']);
    const pedro = persona('pedro', ['vecinos']);
    expect(canal(laura('rojo'), juan, AHORA)).toBe('cerrado');
    expect(canal(laura('rojo'), pedro, AHORA)).toBe('cerrado');
    expect(acciones(laura('rojo'), pedro, AHORA)).toEqual(new Set(['mostrarleMiEstado']));
    expect(acciones(pedro, laura('rojo'), AHORA).size).toBe(0);
  });
});
