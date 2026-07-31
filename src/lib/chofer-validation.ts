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

// ---------------------------------------------------------------------------
// Formato de los datos identificatorios (DNI / CUIL / fechas).
// Viven acá porque los usan el alta, la edición del legajo y el server action:
// si las reglas estuvieran sueltas en cada pantalla, editando se podría guardar
// un CUIL que el alta rechaza.
// ---------------------------------------------------------------------------

export const CUIL_PREFIJOS = ["20", "23", "24", "27", "30", "33", "34"];

/** Va dejando el CUIL como NN-NNNNNNNN-N mientras se escribe. */
export function formatCuil(raw: string): string {
  const digitos = raw.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 10) return `${digitos.slice(0, 2)}-${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}

/** El DNI se guarda sólo con dígitos: la columna es UNIQUE y "20.393.903" y
 *  "20393903" entrarían como dos legajos distintos de la misma persona. */
export function normalizarDni(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 8);
}

/** null = válido. Vacío también: el legajo se puede guardar incompleto. */
export function validarCuil(value: string | null | undefined): string | null {
  const digitos = (value ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length !== 11) return "El CUIL debe tener 11 dígitos.";
  if (!CUIL_PREFIJOS.includes(digitos.slice(0, 2))) return "Prefijo de CUIL inválido.";
  return null;
}

export function validarDni(value: string | null | undefined): string | null {
  const digitos = (value ?? "").replace(/\D/g, "");
  if (!digitos) return null;
  if (digitos.length < 7) return "El DNI debe tener 7 u 8 dígitos.";
  return null;
}

/**
 * Coherencia entre las fechas del legajo. Devuelve el campo con problema y el
 * mensaje, o null si está todo bien. Sólo atrapa lo imposible (un ingreso
 * anterior al nacimiento, una fecha de nacimiento futura): no inventa reglas
 * de negocio que después molesten al cargar un legajo viejo.
 */
export function validarFechasLegajo(f: {
  fecha_nacimiento?: string | null;
  fecha_ingreso?: string | null;
  fecha_egreso?: string | null;
}): { campo: "fecha_nacimiento" | "fecha_ingreso" | "fecha_egreso"; mensaje: string } | null {
  const hoy = new Date().toISOString().split("T")[0]!;
  const nac = f.fecha_nacimiento || null;
  const ing = f.fecha_ingreso || null;
  const egr = f.fecha_egreso || null;

  if (nac) {
    if (nac > hoy) return { campo: "fecha_nacimiento", mensaje: "La fecha de nacimiento no puede ser futura." };
    if (nac < "1900-01-01") return { campo: "fecha_nacimiento", mensaje: "Revisá la fecha de nacimiento." };
  }
  if (ing && nac && ing < nac)
    return { campo: "fecha_ingreso", mensaje: "El ingreso no puede ser anterior al nacimiento." };
  if (egr && ing && egr < ing)
    return { campo: "fecha_egreso", mensaje: "El egreso no puede ser anterior al ingreso." };
  return null;
}

export const MENSAJE_LEGAJO_INCOMPLETO =
  "Este chofer no puede ser asignado a viajes, siniestros ni otros movimientos hasta que se completen los datos obligatorios del legajo.";
