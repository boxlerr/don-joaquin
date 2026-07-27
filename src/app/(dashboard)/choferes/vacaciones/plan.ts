// Plan sugerido para liquidar los saldos viejos antes del 31/12.
// Función PURA: se recalcula en cada render a partir del estado real, así el
// plan se "rearma solo" a medida que se cargan períodos o cambian los saldos.

export type PlanSemana = { start: string; end: string };

export type PlanItem = {
  chofer_id: string;
  apellido: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
};

export type PlanResultado = {
  items: PlanItem[];
  // Empleados a los que no les encontramos lugar (semanas llenas): días que quedan sin ubicar.
  sinLugar: { chofer_id: string; apellido: string; nombre: string; dias: number }[];
};

function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Arma un cronograma propuesto para los empleados con saldo viejo pendiente:
 * bloques de hasta 2 semanas, en las primeras semanas con lugar (sin superar el
 * umbral de ausentes) y sin pisar vacaciones ya cargadas de la misma persona.
 * No modifica nada: son sugerencias para cargar con un clic.
 */
export function planSugerido(opts: {
  urgentes: { chofer_id: string; apellido: string; nombre: string; adeudados: number }[];
  semanas: PlanSemana[]; // desde la semana próxima hasta fin de año
  ocupacion: number[]; // cuántos están de vacaciones en cada semana (ya cargados)
  ocupadoPorChofer: Set<string>; // `${chofer_id}|${semana.start}` si ya tiene vacaciones esa semana
  /** Máximo de ausentes de cada semana (puede variar por mes: diciembre admite más). */
  umbralPorSemana: number[];
}): PlanResultado {
  const { urgentes, semanas, umbralPorSemana } = opts;
  const ocupacion = [...opts.ocupacion];
  const ocupado = new Set(opts.ocupadoPorChofer);
  const topeDe = (i: number) => umbralPorSemana[i] ?? umbralPorSemana[umbralPorSemana.length - 1] ?? 4;

  const items: PlanItem[] = [];
  const sinLugar: PlanResultado["sinLugar"] = [];

  // Primero los que más días deben: son los más difíciles de ubicar.
  const cola = [...urgentes]
    .filter((u) => u.adeudados > 0)
    .sort((a, b) => b.adeudados - a.adeudados || a.apellido.localeCompare(b.apellido));

  for (const u of cola) {
    let restante = u.adeudados;
    let intentos = 0;
    while (restante > 0 && intentos < 12) {
      intentos++;
      const semanasBloque = Math.min(2, Math.ceil(restante / 7));
      let idx = -1;
      for (let ancho = semanasBloque; ancho >= 1 && idx === -1; ancho--) {
        for (let i = 0; i + ancho <= semanas.length; i++) {
          let ok = true;
          for (let j = i; j < i + ancho; j++) {
            if (ocupacion[j]! >= topeDe(j) || ocupado.has(`${u.chofer_id}|${semanas[j]!.start}`)) {
              ok = false;
              break;
            }
          }
          if (ok) {
            idx = i;
            break;
          }
        }
        if (idx !== -1) {
          const dias = Math.min(restante, ancho * 7);
          const fecha_inicio = semanas[idx]!.start;
          const fecha_fin = sumarDias(fecha_inicio, dias - 1);
          items.push({
            chofer_id: u.chofer_id,
            apellido: u.apellido,
            nombre: u.nombre,
            fecha_inicio,
            fecha_fin,
            dias,
          });
          for (let j = idx; j < idx + ancho; j++) {
            ocupacion[j]! += 1;
            ocupado.add(`${u.chofer_id}|${semanas[j]!.start}`);
          }
          restante -= dias;
        }
      }
      if (idx === -1) break; // no hay más lugar para esta persona
    }
    if (restante > 0) {
      sinLugar.push({ chofer_id: u.chofer_id, apellido: u.apellido, nombre: u.nombre, dias: restante });
    }
  }

  items.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio) || a.apellido.localeCompare(b.apellido));
  return { items, sinLugar };
}
