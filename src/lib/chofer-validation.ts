// Reglas de "legajo completo" para choferes.
// Un chofer incompleto se puede crear y figurar en el listado, pero NO puede
// ser asignado a viajes, siniestros, viáticos, gastos, gasoil ni roturas.

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
  completo: boolean;
  faltantes: string[]; // labels listos para mostrar al usuario
};

const CAMPOS_OBLIGATORIOS: { key: keyof ChoferValidable; label: string }[] = [
  { key: "nombre",        label: "Nombre" },
  { key: "apellido",      label: "Apellido" },
  { key: "dni",           label: "DNI" },
  { key: "cuil",          label: "CUIL" },
  { key: "telefono",      label: "Teléfono" },
  { key: "localidad",     label: "Localidad" },
  { key: "fecha_ingreso", label: "Fecha de ingreso" },
];

export function getLegajoEstado(c: ChoferValidable): LegajoEstado {
  const faltantes: string[] = [];
  for (const { key, label } of CAMPOS_OBLIGATORIOS) {
    const v = c[key];
    if (v == null || String(v).trim() === "") faltantes.push(label);
  }
  return { completo: faltantes.length === 0, faltantes };
}

export function isLegajoCompleto(c: ChoferValidable): boolean {
  return getLegajoEstado(c).completo;
}

export const MENSAJE_LEGAJO_INCOMPLETO =
  "Este chofer no puede ser asignado a viajes, siniestros ni otros movimientos hasta que se completen los datos obligatorios del legajo.";
