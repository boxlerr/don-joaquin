/**
 * Las formas que se pasan entre el servidor y la pantalla del chofer.
 *
 * Van acá y no en `actions.ts` porque un módulo `"use server"` sólo puede
 * exportar funciones async: un `export type` ahí adentro compila, pasa los tests
 * y después rompe el deploy o tira un 500 en runtime.
 */

/** Un chofer, para que se elija a sí mismo. Sólo el nombre: la URL es pública. */
export type ChoferParaEnlace = { id: string; nombre: string };

export type VueltaAnotada = {
  litros: number;
  litrosPorTonelada: number;
  toneladas: number;
  cantera: string;
  destino: string;
  /** Ya estaba anotada: el dedo tocó dos veces o se recargó la página. */
  yaEstaba: boolean;
};

export type ResultadoAnotar =
  | { ok: true; vuelta: VueltaAnotada }
  /** El motivo se le muestra tal cual al chofer: tiene que poder actuar con eso. */
  | { ok: false; mensaje: string };

/** Una vuelta del chofer, con su saldo, tal como la ve en el enlace. */
export type VueltaDelChofer = {
  id: string;
  /** "YYYY-MM-DD" en hora de Argentina. */
  fecha: string;
  /** "HH:MM". */
  hora: string;
  cantera: string;
  destino: string;
  toneladas: number;
  litrosPorTonelada: number;
  /** Los litros que le corresponden a la vuelta. */
  litros: number;
  /** Es de hoy: es la que todavía está cargando. */
  enCurso: boolean;
  cargas: { id: string; litros: number; previa: boolean; hora: string }[];
};

export type ResultadoCarga =
  | { ok: true; vueltas: VueltaDelChofer[] }
  | { ok: false; mensaje: string };
