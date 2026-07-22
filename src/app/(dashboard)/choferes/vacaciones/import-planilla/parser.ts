// Parser de la planilla de vacaciones de Bárbara ("VACACIONES 2.xlsx"):
// hojas CANTIDAD DE DIAS CHOFERES, CRONOGRAMA CHOFERES, CANTIDAD DIAS Y
// CRONOGRAMA OFI, Hoja2 (oficina) y VACACIONES TALLER. Funciones PURAS sobre
// matrices de celdas (sin xlsx ni DB) para poder testearlas.

export type Celda = string | number | Date | boolean | null | undefined;
export type Matriz = Celda[][];

export type EmpleadoRef = {
  id: string;
  nombre: string;
  apellido: string;
  activo: boolean;
};

// ── nombres ───────────────────────────────────────────────────────────────────

export function normalizar(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Apodos y abreviaturas que usa la planilla → "apellido nombre" único del sistema.
export const ALIAS: Record<string, string> = {
  "acosta": "acosta pablo maximo",
  "garcia": "garcia eduardo walter",
  "fernandez f": "fernandez facundo fabian",
  "fernandez facundo": "fernandez facundo fabian",
  "fernandez jose": "fernandez jose luis",
  "fernandez j": "fernandez jose luis",
  "jonatan heim": "heim jonatan",
  "heim jonatan": "heim jonatan",
  "juarez nahuel": "juarez luis nahuel",
  "juarez luis": "juarez luis mario",
  "juarez gon": "juarez gonzalo oscar",
  "cejas n": "cejas nazareno elias",
  "cejas naz": "cejas nazareno elias",
  "anabela": "paterno anabela",
  "anabella": "paterno anabela",
  "trejo": "trejo juan carlos",
  "rossi": "rossi adrian emilio",
  "de libano": "de libano elorrieta oscar adrian",
  "grassi": "grassi bruno emmanuel",
  "alexis joaquin": "joaquin alan alexis",
  "alan joaquin": "joaquin alan alexis",
  "kevin joaquin": "joaquin kevin agustin",
  "salto maxi": "salto maximiliano miguel",
  "maxi salto": "salto maximiliano miguel",
  "pablo diaz": "diaz pablo ricardo",
  "diaz pablo": "diaz pablo ricardo",
  "orlando": "orlando nestor ramon",
  "orlando nestor": "orlando nestor ramon",
  "paredez": "paredez daniel orlando",
};

export type MatchResultado =
  | { tipo: "ok"; empleado: EmpleadoRef }
  | { tipo: "ambiguo"; candidatos: string[] }
  | { tipo: "sin_match" };

export function crearMatcher(empleados: EmpleadoRef[]) {
  const porClave = new Map<string, EmpleadoRef>();
  for (const e of empleados) porClave.set(normalizar(`${e.apellido} ${e.nombre}`), e);

  return (nombreExcel: string): MatchResultado => {
    const q = normalizar((nombreExcel || "").replace(/,/g, " ").replace(/\d+\s*$/, ""));
    if (!q) return { tipo: "sin_match" };
    if (ALIAS[q]) {
      const e = porClave.get(ALIAS[q]);
      return e ? { tipo: "ok", empleado: e } : { tipo: "sin_match" };
    }
    const qt = new Set(q.split(" "));
    const candidatos: { score: number; e: EmpleadoRef }[] = [];
    for (const [clave, e] of porClave) {
      const ct = new Set(clave.split(" "));
      const inter = [...qt].filter((t) => ct.has(t)).length;
      const esSub = [...qt].every((t) => ct.has(t)) || [...ct].every((t) => qt.has(t));
      if (esSub && inter > 0) candidatos.push({ score: inter, e });
    }
    if (candidatos.length === 0) return { tipo: "sin_match" };
    candidatos.sort((a, b) => b.score - a.score);
    if (candidatos.length > 1 && candidatos[0]!.score === candidatos[1]!.score) {
      return { tipo: "ambiguo", candidatos: candidatos.map((c) => `${c.e.apellido} ${c.e.nombre}`) };
    }
    return { tipo: "ok", empleado: candidatos[0]!.e };
  };
}

// ── celdas ────────────────────────────────────────────────────────────────────

function esFecha(v: Celda): v is Date {
  return v instanceof Date && !isNaN(v.getTime());
}

export function aISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function valorBloque(fila: Celda[], desde: number, hasta: number): number | null {
  for (let i = desde; i <= hasta; i++) {
    const v = fila[i];
    if (v == null || String(v).trim() === "") continue;
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

// ── hoja CANTIDAD DE DIAS CHOFERES ────────────────────────────────────────────
// nombre | ingreso | años | meses | [2022: E-H] [2023: I-L] [2024: M-P] [2025: Q-T] [2026: U-W]

export type SaldoPlanilla = { nombre: string; porAnio: Map<number, number> };

export function parseCantidad(rows: Matriz): SaldoPlanilla[] {
  const out: SaldoPlanilla[] = [];
  for (const fila of rows.slice(1)) {
    const nombre = fila[0];
    if (nombre == null || String(nombre).trim() === "" || esFecha(nombre)) continue;
    const porAnio = new Map<number, number>();
    const bloques: [number, number, number][] = [
      [2022, 4, 7],
      [2023, 8, 11],
      [2024, 12, 15],
      [2025, 16, 19],
      [2026, 20, 22],
    ];
    for (const [anio, d, h] of bloques) {
      const v = valorBloque(fila, d, h);
      if (v != null) porAnio.set(anio, v);
    }
    out.push({ nombre: String(nombre).trim(), porAnio });
  }
  return out;
}

// ── hojas con bloques por año (Hoja2 de oficina, VACACIONES TALLER) ──────────
// Una fila-encabezado con fecha "2026-12-31" abre el bloque de ese año; luego
// filas nombre | ingreso | años | meses | ... | valor (cols F-I).

export function parseBloquesAnio(rows: Matriz): SaldoPlanilla[] {
  const porNombre = new Map<string, Map<number, number>>();
  let anio: number | null = null;
  for (const fila of rows) {
    const c0 = fila[0];
    if (esFecha(c0)) {
      anio = c0.getFullYear();
      continue;
    }
    if (anio == null || c0 == null || String(c0).trim() === "") continue;
    const v = valorBloque(fila, 5, 8);
    if (v == null) continue;
    const clave = normalizar(String(c0));
    const m = porNombre.get(clave) ?? new Map<number, number>();
    m.set(anio, v);
    porNombre.set(clave, m);
  }
  // se devuelve con el nombre normalizado: el matcher lo resuelve igual
  return [...porNombre.entries()].map(([nombre, porAnio]) => ({ nombre, porAnio }));
}

// ── cronogramas semanales ────────────────────────────────────────────────────
// Grillas: fila de fechas (lun→dom) y debajo filas de nombres alineados por día.
// Ojo: el corte por encabezado exige el día COMPLETO ("sábado"), no la inicial,
// para no comerse nombres como "SERGIO SCHMIDT".

const RE_DIA = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)\b/;
const RE_MES = /^(1er|2da|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)/;

export type Presencia = { nombre: string; fecha: string };

export function parseCronograma(rows: Matriz): Presencia[] {
  const presencias: Presencia[] = [];
  let i = 0;
  while (i < rows.length) {
    const fila = rows[i]!;
    const fechas = fila.slice(0, 7).map((v) => (esFecha(v) ? v : null));
    if (fechas.filter(Boolean).length >= 4) {
      let j = i + 1;
      while (j < rows.length) {
        const f2 = rows[j]!;
        if (f2.slice(0, 7).some((v) => esFecha(v))) break;
        const celdas = f2.slice(0, 7).map((v) => (v == null ? "" : String(v).trim()));
        if (celdas.some((c) => c && RE_DIA.test(c.toLowerCase()))) break;
        if (celdas.every((c) => c === "")) {
          j++;
          continue;
        }
        for (let k = 0; k < celdas.length; k++) {
          const c = celdas[k]!;
          const f = fechas[k];
          if (!c || !f) continue;
          const nombre = c.replace(/\s*\d+\s*$/, "").trim();
          if (!nombre || RE_MES.test(nombre.toLowerCase())) continue;
          presencias.push({ nombre, fecha: aISO(f) });
        }
        j++;
      }
      i = j;
    } else {
      i++;
    }
  }
  return presencias;
}

export type RangoPersona = { empleado: EmpleadoRef; fecha_inicio: string; fecha_fin: string; dias: number };

export function rangosPorPersona(
  presencias: Presencia[],
  matcher: ReturnType<typeof crearMatcher>,
): { rangos: RangoPersona[]; sinMatch: string[] } {
  const fechasPorId = new Map<string, { empleado: EmpleadoRef; fechas: Set<string> }>();
  const sinMatch = new Set<string>();
  for (const p of presencias) {
    const m = matcher(p.nombre);
    if (m.tipo !== "ok") {
      sinMatch.add(p.nombre);
      continue;
    }
    const e = fechasPorId.get(m.empleado.id) ?? { empleado: m.empleado, fechas: new Set<string>() };
    e.fechas.add(p.fecha);
    fechasPorId.set(m.empleado.id, e);
  }
  const rangos: RangoPersona[] = [];
  const unDia = 86_400_000;
  for (const { empleado, fechas } of fechasPorId.values()) {
    const fs = [...fechas].sort();
    let ini = fs[0]!;
    let fin = fs[0]!;
    const push = () => {
      const dias =
        Math.round((new Date(fin + "T00:00:00").getTime() - new Date(ini + "T00:00:00").getTime()) / unDia) + 1;
      rangos.push({ empleado, fecha_inicio: ini, fecha_fin: fin, dias });
    };
    for (const f of fs.slice(1)) {
      const gap = Math.round((new Date(f + "T00:00:00").getTime() - new Date(fin + "T00:00:00").getTime()) / unDia);
      if (gap <= 1) {
        fin = f;
      } else {
        push();
        ini = fin = f;
      }
    }
    push();
  }
  rangos.sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  return { rangos, sinMatch: [...sinMatch].sort() };
}
