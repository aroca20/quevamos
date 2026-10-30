import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import type { EstadoDisponibilidad, EstadoPersonalizado } from '../motor';
import * as Modelo from './modelo';

/** Conecta el modelo de la pantalla «Ahora» con React y revisa la caducidad cada 15 segundos. */
export function useAhora() {
  const [modelo, setModelo] = useState<Modelo.ModeloAhora>(Modelo.modeloInicial);

  useEffect(() => {
    const revisar = () => setModelo((m) => Modelo.comprobarCaducidad(m, new Date()));
    const intervalo = setInterval(revisar, 15_000);
    // Al volver a la app, comprueba enseguida: en segundo plano los temporizadores se paran.
    const suscripcion = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') revisar();
    });
    return () => {
      clearInterval(intervalo);
      suscripcion.remove();
    };
  }, []);

  return {
    modelo,
    elegir: useCallback((estado: EstadoDisponibilidad) => setModelo((m) => Modelo.elegir(m, estado, new Date())), []),
    cambiarDuracion: useCallback((id: string) => setModelo((m) => Modelo.cambiarDuracion(m, id, new Date())), []),
    deshacer: useCallback(() => setModelo(Modelo.deshacer), []),
    guardarPersonalizado: useCallback(
      (nuevo: EstadoPersonalizado) => setModelo((m) => Modelo.guardarPersonalizado(m, nuevo, new Date())),
      [],
    ),
    borrarPersonalizado: useCallback(() => setModelo(Modelo.borrarPersonalizado), []),
  };
}
