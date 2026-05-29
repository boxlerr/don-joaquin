// Cálculo de eficiencia de combustible (L/100km) a partir de cargas de gasoil.
//
// Método: se agrupan las cargas por camión, se ordenan por odómetro y se suman
// los litros contra el delta de km entre cargas consecutivas. Los deltas fuera
// de rango (resets de odómetro, datos mal cargados) se descartan.
//
// Usado por el módulo /combustible (stats y ranking) y por la pestaña
// Productividad del legajo del chofer — misma lógica, mismos números.

export const DELTA_KM_MAX_RAZONABLE = 5000; // descarta deltas absurdos (resets de odómetro, datos cargados mal)
export const DELTA_KM_MIN = 1;

export type CargaEficiencia = {
  camion_id: string;
  km_odometro: number;
  litros: number;
};

export type EficienciaResult = {
  litrosUsados: number; // litros contabilizados en deltas válidos
  kmRecorridos: number; // km contabilizados en deltas válidos
  eficiencia: number | null; // L/100km, null si no hay deltas suficientes
};

export function calcularEficienciaPorDeltas(
  cargas: CargaEficiencia[],
): EficienciaResult {
  let litrosUsados = 0;
  let kmRecorridos = 0;

  const porCamion = new Map<string, CargaEficiencia[]>();
  for (const c of cargas) {
    if (!porCamion.has(c.camion_id)) porCamion.set(c.camion_id, []);
    porCamion.get(c.camion_id)!.push(c);
  }

  for (const grupo of porCamion.values()) {
    grupo.sort((a, b) => a.km_odometro - b.km_odometro);
    for (let i = 1; i < grupo.length; i++) {
      const delta = grupo[i].km_odometro - grupo[i - 1].km_odometro;
      if (delta >= DELTA_KM_MIN && delta <= DELTA_KM_MAX_RAZONABLE) {
        litrosUsados += Number(grupo[i].litros);
        kmRecorridos += delta;
      }
    }
  }

  const eficiencia = kmRecorridos > 0 ? (litrosUsados / kmRecorridos) * 100 : null;
  return { litrosUsados, kmRecorridos, eficiencia };
}
