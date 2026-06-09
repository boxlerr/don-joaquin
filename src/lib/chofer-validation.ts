// Reglas de "legajo completo" para choferes.
// Bloqueantes: sin estos datos el chofer NO puede asignarse a viajes, siniestros,
// viáticos, etc. (son los datos legales/identificatorios mínimos).
// Recomendados (teléfono, localidad): NO bloquean — solo se avisa que faltan.

export type ChoferValidable = {
  nombre?: string | null;
  apellido?: string | null;
  dni?: string | null;
  cuil?: string | null;
  telefono?: string | null;
  localidad?: string | null;
  fecha_ingreso?: string | null;
};

export type LegajoEstado = {
  completo: boolean; // true si no falta ningún dato BLOQUEANTE (sirve para asignar)
  faltantes: string[]; // bloqueantes faltantes
  faltantesRecomendados: string[]; // teléfono/localidad faltantes (no bloquean)
};

// Bloquean la asignación (datos identificatorios mínimos).
const CAMPOS_BLOQUEANTES: { key: keyof ChoferValidable; label: string }[] = [
  { key: "nombre",        label: "Nombre" },
  { key: "apellido",      label: "Apellido" },
  { key: "dni",           label: "DNI" },
  { key: "cuil",          label: "CUIL" },
  { key: "fecha_ingreso", label: "Fecha de ingreso" },
];

// Solo se avisan, no bloquean nada.
const CAMPOS_RECOMENDADOS: { key: keyof ChoferValidable; label: string }[] = [
  { key: "telefono",  label: "Teléfono" },
  { key: "localidad", label: "Localidad" },
];

const falta = (c: ChoferValidable, key: keyof ChoferValidable) => {
  const v = c[key];
  return v == null || String(v).trim() === "";
};

export function getLegajoEstado(c: ChoferValidable): LegajoEstado {
  const faltantes = CAMPOS_BLOQUEANTES.filter(({ key }) => falta(c, key)).map((x) => x.label);
  const faltantesRecomendados = CAMPOS_RECOMENDADOS.filter(({ key }) => falta(c, key)).map((x) => x.label);
  return { completo: faltantes.length === 0, faltantes, faltantesRecomendados };
}

export function isLegajoCompleto(c: ChoferValidable): boolean {
  return getLegajoEstado(c).completo;
}

export const MENSAJE_LEGAJO_INCOMPLETO =
  "Este chofer no puede ser asignado a viajes, siniestros ni otros movimientos hasta que se completen los datos obligatorios del legajo.";
