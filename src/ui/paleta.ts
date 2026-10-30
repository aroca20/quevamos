import type { ColorPersonalizado, Nivel } from '../motor';

/** Lo necesario para dibujar un estado: la forma la da el nivel y el color, el semáforo o el elegido. */
export interface Aspecto {
  nivel: Nivel;
  /** `null` para los estados fijos, que usan los colores del semáforo. */
  color: ColorPersonalizado | null;
}

type Par = readonly [claro: string, oscuro: string];

const RELLENO_FIJO: Record<Nivel, Par> = {
  verde: ['#1E9A53', '#3FC377'],
  amarillo: ['#D99A0E', '#F1B63C'],
  rojo: ['#D4413A', '#FF7064'],
  desconocido: ['#939A97', '#7F8884'],
};

const SUAVE_FIJO: Record<Nivel, Par> = {
  verde: ['#E1F3E7', '#13301F'],
  amarillo: ['#FBF0D4', '#372B0F'],
  rojo: ['#FAE3E1', '#3B1815'],
  desconocido: ['#EAEDEA', '#252A28'],
};

/** Los colores personalizados son pastel: llevan un borde más oscuro para alcanzar el contraste de 3:1. */
const PERSONALIZADOS: Record<ColorPersonalizado, { relleno: Par; borde: Par; suave: Par }> = {
  cielo: { relleno: ['#A9D4F5', '#8CC4EF'], borde: ['#1D5E98', '#6CB1EA'], suave: ['#E4F1FB', '#13283A'] },
  anil: { relleno: ['#B9C2F6', '#A4AEF1'], borde: ['#3445A3', '#8D9AEE'], suave: ['#ECEEFC', '#1B2042'] },
  lavanda: { relleno: ['#CEBCF3', '#BCA7EF'], borde: ['#5A3DAA', '#A88EEC'], suave: ['#F0EBFC', '#251C3B'] },
  orquidea: { relleno: ['#E7BCEE', '#DCA8E7'], borde: ['#7C3190', '#CD8EDC'], suave: ['#F9EDFB', '#2F1A35'] },
  rosa: { relleno: ['#F6BDD7', '#F1AACA'], borde: ['#A02E65', '#E98BB6'], suave: ['#FCEBF3', '#3B1727'] },
};

const elegir = (par: Par, oscuro: boolean) => (oscuro ? par[1] : par[0]);

export function relleno(aspecto: Aspecto, oscuro: boolean): string {
  return aspecto.color
    ? elegir(PERSONALIZADOS[aspecto.color].relleno, oscuro)
    : elegir(RELLENO_FIJO[aspecto.nivel], oscuro);
}

export function borde(aspecto: Aspecto, oscuro: boolean): string {
  return aspecto.color ? elegir(PERSONALIZADOS[aspecto.color].borde, oscuro) : relleno(aspecto, oscuro);
}

/** Fondo suave de tarjetas y botones elegidos. */
export function suave(aspecto: Aspecto, oscuro: boolean): string {
  return aspecto.color
    ? elegir(PERSONALIZADOS[aspecto.color].suave, oscuro)
    : elegir(SUAVE_FIJO[aspecto.nivel], oscuro);
}

/** Color de los símbolos dibujados sobre el círculo (pausa, barra, interrogación). */
export function glifo(aspecto: Aspecto, oscuro: boolean): string {
  if (oscuro) return '#0F1211';
  return aspecto.color ? borde(aspecto, false) : '#FFFFFF';
}

/** Colores de la interfaz en modo claro y oscuro. */
export function tema(oscuro: boolean) {
  return oscuro
    ? {
        fondo: '#000000',
        tarjeta: '#1C1C1E',
        texto: '#F5F5F7',
        secundario: '#A1A1A6',
        separador: '#3A3A3C',
        acento: '#7FB2FF',
        peligro: '#FF6961',
      }
    : {
        fondo: '#F2F2F7',
        tarjeta: '#FFFFFF',
        texto: '#111111',
        secundario: '#5F6368',
        separador: '#C7C7CC',
        acento: '#0A5BD3',
        peligro: '#C0362C',
      };
}

export type Tema = ReturnType<typeof tema>;
