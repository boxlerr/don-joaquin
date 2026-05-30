// Tipos y defaults de los criterios del ranking. Cada criterio define cuántos
// puntos resta sobre la base de 100. SIN "server-only" para poder importarlos
// tanto desde server (lib.ts / actions.ts) como desde el client component de
// configuración (CriteriosButton).


export type RankingCriterios = {
  vacios_leve: number;
  vacios_moderado: number;
  vacios_alto: number;
  rotura: number;
  taller: number;
  aperc: number;
  licencia: number;
};

export const RANKING_CRITERIOS_DEFAULT: RankingCriterios = {
  vacios_leve: 8,
  vacios_moderado: 15,
  vacios_alto: 20,
  rotura: 5,
  taller: 3,
  aperc: 8,
  licencia: 10,
};

export const CRITERIO_CLAVE: Record<keyof RankingCriterios, string> = {
  vacios_leve: "ranking_pen_vacios_leve",
  vacios_moderado: "ranking_pen_vacios_moderado",
  vacios_alto: "ranking_pen_vacios_alto",
  rotura: "ranking_pen_rotura",
  taller: "ranking_pen_taller",
  aperc: "ranking_pen_aperc",
  licencia: "ranking_pen_licencia",
};
