import { crearEstadoPersonalizado, type EstadoPersonalizado, type NivelVisible } from '../../motor';
import {
  borrarPersonalizado,
  cambiarDuracion,
  comprobarCaducidad,
  deshacer,
  elegir,
  guardarPersonalizado,
  modeloInicial,
  opciones,
} from '../modelo';

// Fechas en hora local para que las pruebas no dependan de la zona horaria.
const AHORA = new Date(2026, 9, 29, 17, 0);
const MIN_MS = 60_000;

function entrenando(funcionaComo: NivelVisible): EstadoPersonalizado {
  const estado = crearEstadoPersonalizado('Entrenando', 'lavanda', funcionaComo);
  if (!estado) throw new Error('nombre no válido');
  return estado;
}

describe('Pantalla Ahora', () => {
  test('Verde dura una hora por defecto y, al caducar, vuelve al reposo', () => {
    const enVerde = elegir(modeloInicial, 'verde', AHORA);
    expect(enVerde.opcionElegida).toBe('60');
    expect(enVerde.hasta).toEqual(new Date(AHORA.getTime() + 60 * MIN_MS));
    expect(comprobarCaducidad(enVerde, new Date(AHORA.getTime() + 59 * MIN_MS)).estado).toBe('verde');
    const caducado = comprobarCaducidad(enVerde, new Date(AHORA.getTime() + 61 * MIN_MS));
    expect(caducado.estado).toBe('rojo');
    expect(caducado.esReposo).toBe(true);
  });

  test('deshacer recupera el estado anterior', () => {
    const enVerde = elegir(modeloInicial, 'verde', AHORA);
    expect(deshacer(enVerde)).toEqual(modeloInicial);
  });

  test('«Hasta mañana» termina a las 8:00 siguientes', () => {
    const noche = new Date(2026, 9, 29, 22, 0);
    const madrugada = new Date(2026, 9, 30, 6, 30);
    expect(cambiarDuracion(elegir(modeloInicial, 'amarillo', noche), 'manana', noche).hasta).toEqual(
      new Date(2026, 9, 30, 8, 0),
    );
    expect(cambiarDuracion(elegir(modeloInicial, 'amarillo', madrugada), 'manana', madrugada).hasta).toEqual(
      new Date(2026, 9, 30, 8, 0),
    );
  });

  test('el personalizado no se puede elegir hasta crearlo', () => {
    expect(elegir(modeloInicial, 'personalizado', AHORA)).toBe(modeloInicial);
  });

  test('el personalizado que funciona como Verde también caduca', () => {
    const conEstado = guardarPersonalizado(modeloInicial, entrenando('verde'), AHORA);
    const enUso = elegir(conEstado, 'personalizado', AHORA);
    expect(opciones(enUso, 'personalizado').map((o) => o.id)).toEqual(['30', '60', '120']);
    expect(enUso.hasta).toEqual(new Date(AHORA.getTime() + 60 * MIN_MS));
  });

  test('si pasa a funcionar como Verde, toma una duración que caduca', () => {
    const enUso = elegir(guardarPersonalizado(modeloInicial, entrenando('amarillo'), AHORA), 'personalizado', AHORA);
    expect(enUso.opcionElegida).toBe('sin');
    const comoVerde = guardarPersonalizado(enUso, entrenando('verde'), AHORA);
    expect(comoVerde.opcionElegida).toBe('60');
    expect(comoVerde.hasta).toEqual(new Date(AHORA.getTime() + 60 * MIN_MS));
  });

  test('al borrar el personalizado pasas al color con el que funcionaba', () => {
    const enUso = elegir(guardarPersonalizado(modeloInicial, entrenando('amarillo'), AHORA), 'personalizado', AHORA);
    const borrado = borrarPersonalizado(enUso);
    expect(borrado.estado).toBe('amarillo');
    expect(borrado.personalizado).toBeNull();
  });
});
