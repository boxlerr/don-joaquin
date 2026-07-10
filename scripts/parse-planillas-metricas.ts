/**
 * Parser de las 6 planillas mensuales de gestión (PDFs del Drive de Bárbara).
 *
 * Como CLI genera SQL idempotente para `metricas_chofer_mes` / `metricas_mes`:
 *
 *   pdftotext -layout "SUELDO SOBRE FACTURACION MAYO 2026.pdf" sueldo-fact.txt
 *   ... (fact-km / costo-km / km-vacios / km-100 / toneladas)
 *   npx tsx scripts/parse-planillas-metricas.ts <dir> 2026-05 --parciales GOMEZ,CLEMENTE
 *
 * También exporta `parsePlanillasDir()` para la carga masiva desde el Drive
 * (scripts/cargar-metricas-drive.ts).
 *
 * Verifica las sumas contra las filas TOTAL de cada planilla: si algo no
 * cierra, NO aplicar sin mirar.
 */
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

export type FilaChofer = {
  flota: "escalables" | "tolvas";
  nombre: string;
  escalTipo?: 35 | 37;
  km?: number;
  kmVacios?: number;
  km100?: number;
  facturacion?: number;
  sueldoTotal?: number;
  sueldoNeto?: number;
  toneladas?: number;
  ingresoParcial: boolean;
};

export type FilaMes = {
  mes: string;
  flota: string | null;
  km?: number;
  facturacion?: number;
  factKm?: number;
  costoKm?: number;
  promKm?: number;
  fuente: string;
};

export type ParseResult = {
  mes: string;
  filas: FilaChofer[];
  mesesRows: FilaMes[];
  checks: string[];
  warnings: string[];
  /** true si alguna suma no cierra contra la fila TOTAL de la planilla. */
  mismatch: boolean;
};

// ── helpers ────────────────────────────────────────────────────────────────
const num = (s: string): number => {
  const clean = s.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  if (!Number.isFinite(n)) throw new Error(`No es número: "${s}"`);
  return n;
};

function splitRow(rawLine: string): { nombre: string; valores: number[]; pos: number[] } | null {
  // pdftotext mete \f en los saltos de página: se reemplaza por espacio para
  // no perder la primera fila de cada página (mismo largo → posiciones OK).
  const line = rawLine.replace(/\f/g, " ");
  const m = line.match(/^( {0,12})([A-ZÑÁÉÍÓÚ][A-ZÑÁÉÍÓÚ.\s]*?)\s{2,}(?=\S)/);
  if (!m) return null;
  const nombre = m[2].trim().replace(/\s+/g, " ");
  if (/TOTAL|PROMEDIO|CHOFER|MESES|FACTURACI|SUELDO|KM|TONELADAS|ESCAL|TOLVAS/.test(nombre)) return null;
  // Tokens numéricos con su posición horizontal (centro), para poder asignar
  // por columna cuando una celda viene vacía (pasa seguido en estas planillas).
  const valores: number[] = [];
  const pos: number[] = [];
  const re = /\$?\s?-?[\d.]+(?:,\d+)?/g;
  let t: RegExpExecArray | null;
  while ((t = re.exec(line.slice(m[0].length)))) {
    valores.push(num(t[0]));
    pos.push(m[0].length + t.index + t[0].length / 2);
  }
  if (!valores.length) return null;
  return { nombre, valores, pos };
}

/** ¿v es (casi) igual a ref? Tolerancia chica para cruces entre planillas. */
const casiIgual = (v: number, ref: number | undefined) => ref != null && Math.abs(v - ref) <= 2;

const MESES_ABREV: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sept: "09", sep: "09", oct: "10", nov: "11", dic: "12",
};
const MES_NOMBRE: Record<string, string> = {
  ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04", MAYO: "05", JUNIO: "06",
  JULIO: "07", AGOSTO: "08", SEPTIEMBRE: "09", OCTUBRE: "10", NOVIEMBRE: "11", DICIEMBRE: "12",
};

/** Parsea todos los .txt de un directorio de mes → filas consolidadas + chequeos. */
export function parsePlanillasDir(dir: string, mesISO: string, parciales: Set<string>): ParseResult {
  const filas = new Map<string, FilaChofer>();
  const warnings: string[] = [];
  const checks: string[] = [];
  let mismatch = false;
  const mesesRows: FilaMes[] = [];

  const filaDe = (flota: FilaChofer["flota"], nombre: string): FilaChofer => {
    const key = `${flota}|${nombre}`;
    if (!filas.has(key)) filas.set(key, { flota, nombre, ingresoParcial: parciales.has(nombre.toUpperCase()) });
    return filas.get(key)!;
  };
  /**
   * Flota para valores que vienen SIN flota (bloques sin título): la conocida
   * de fact-km; si el chofer cambió de flota a mitad de mes (está en ambas),
   * la dominante por km. `fallback` cuando no se lo conoce de ningún lado.
   */
  const flotaResuelta = (nombre: string, fallback: FilaChofer["flota"]): FilaChofer["flota"] => {
    const esc = filas.get(`escalables|${nombre}`);
    const tol = filas.get(`tolvas|${nombre}`);
    if (esc && !tol) return "escalables";
    if (tol && !esc) return "tolvas";
    if (esc && tol) return (esc.km ?? 0) >= (tol.km ?? 0) ? "escalables" : "tolvas";
    return fallback;
  };
  const checkTotal = (tag: string, esperado: number | null, real: number) => {
    if (esperado == null) return;
    const ok = Math.abs(esperado - real) <= 1.5;
    checks.push(`${ok ? "✓" : "✗ MISMATCH"} ${tag}: planilla=${esperado} calculado=${Math.round(real * 100) / 100}`);
    if (!ok) {
      mismatch = true;
      warnings.push(`Suma que no cierra en ${tag}`);
    }
  };
  const totalDe = (lines: string[], desde: number, hasta: number): number[] | null => {
    for (let i = desde; i < hasta; i++) {
      if (/^\s*TOTAL\s/.test(lines[i])) return (lines[i].match(/\$?\s?[\d.]+(?:,\d+)?/g) ?? []).map(num);
    }
    return null;
  };
  const leer = (patron: RegExp): string[] | null => {
    const f = readdirSync(dir).find((x) => patron.test(x) && x.endsWith(".txt"));
    return f ? readFileSync(join(dir, f), "utf8").split("\n") : null;
  };
  const marcas = (lines: string[], re: RegExp): number[] =>
    lines.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);

  // 1) FACTURACION POR KM (mensual, por chofer)
  {
    const lines = leer(/^fact-km(?!.*anual)/i);
    if (!lines) warnings.push("Falta fact-km*.txt");
    else {
      const headers = marcas(lines, /FACTURACION POR KM\s+(ESCALABLES|TOLVAS)/i);
      headers.forEach((h, i) => {
        const flota = /TOLVAS/i.test(lines[h]) ? "tolvas" : "escalables";
        const fin = headers[i + 1] ?? lines.length;
        let sumKm = 0, sumFact = 0, n = 0;
        for (let j = h + 1; j < fin; j++) {
          const r = splitRow(lines[j]);
          if (!r || r.valores.length < 3) continue;
          const f = filaDe(flota, r.nombre);
          f.km = r.valores[0];
          f.facturacion = r.valores[1];
          sumKm += r.valores[0]; sumFact += r.valores[1]; n++;
        }
        const tot = totalDe(lines, h, fin);
        checkTotal(`fact-km ${flota} km (${n} filas)`, tot?.[0] ?? null, sumKm);
        checkTotal(`fact-km ${flota} facturación`, tot?.[1] ?? null, sumFact);
      });
    }
  }

  // 2) KM VACIOS — columnas: KM · KM VACIO · % (a veces falta el % o el vacío).
  //    fact-km ya corrió, así que f.km sirve de ancla para filas incompletas.
  {
    const lines = leer(/^km-vacios/i);
    if (!lines) warnings.push("Falta km-vacios*.txt");
    else {
      const headers = marcas(lines, /KM VACIO\S*\s+(ESCALABLES|TOLVAS)/i);
      headers.forEach((h, i) => {
        const flotaSeccion = /TOLVAS/i.test(lines[h]) ? "tolvas" : "escalables";
        const fin = headers[i + 1] ?? lines.length;
        let sum = 0, n = 0, bloque = 1;
        for (let j = h + 1; j < fin; j++) {
          if (/^\s*TOTAL\s/.test(lines[j])) {
            const tot = (lines[j].match(/\$?\s?[\d.]+(?:,\d+)?/g) ?? []).map(num);
            checkTotal(
              `km-vacios ${flotaSeccion}${bloque > 1 ? ` bloque ${bloque}` : ""} (${n} filas)`,
              tot[1] ?? null,
              sum,
            );
            sum = 0; n = 0; bloque++;
            continue;
          }
          const r = splitRow(lines[j]);
          if (!r) continue;
          // La columna % va siempre última: si el último token es < 100 es el
          // porcentaje (aun "0,00"), no un km.
          const vals = [...r.valores];
          let pct: number | null = null;
          if (vals.length && vals[vals.length - 1] < 100) pct = vals.pop()!;
          if (!vals.length) continue;
          const flota = bloque === 1 ? flotaSeccion : flotaResuelta(r.nombre, flotaSeccion);
          const f = filaDe(flota, r.nombre);
          let kmVacios: number;
          if (vals.length >= 2) {
            kmVacios = vals[1]; // [km, vacío]
          } else {
            // Un solo valor: si el % es 0 la celda del vacío está en blanco (el
            // valor es el km); si no, el valor ES el vacío.
            kmVacios = pct === 0 || casiIgual(vals[0], f.km) ? 0 : vals[0];
          }
          f.kmVacios = kmVacios;
          sum += kmVacios; n++;
        }
      });
    }
  }

  // 3) KM AL 100% — el orden de columnas cambió con los años:
  //    2024: ESCALABLES · KM AL 100% · KM TOTALES · %
  //    2025+: ESCALABLES · KM TOTALES · KM AL 100 · %
  //    Filas incompletas: se resuelve con f.km (de fact-km) como ancla.
  {
    const lines = leer(/^km-100/i);
    if (!lines) warnings.push("Falta km-100*.txt");
    else {
      const headers = marcas(lines, /(ESCALABLES|TOLVAS)\s+(KM TOTALES|KM AL|100)/i);
      headers.forEach((h, i) => {
        const flotaSeccion = /TOLVAS/i.test(lines[h]) ? "tolvas" : "escalables";
        const fin = headers[i + 1] ?? lines.length;
        const idx100 = lines[h].search(/100/);
        const idxTot = lines[h].search(/KM TOTALES/);
        const km100Primero = idx100 >= 0 && (idxTot < 0 || idx100 < idxTot);
        // Sub-bloques delimitados por filas TOTAL: puede haber un bloque extra
        // sin título (choferes que cambiaron de flota, con valores combinados).
        let sum = 0, n = 0, bloque = 1;
        for (let j = h + 1; j < fin; j++) {
          if (/^\s*TOTAL\s/.test(lines[j])) {
            const tot = (lines[j].match(/\$?\s?[\d.]+(?:,\d+)?/g) ?? []).map(num);
            checkTotal(
              `km-100 ${flotaSeccion}${bloque > 1 ? ` bloque ${bloque}` : ""} (${n} filas)`,
              tot[km100Primero ? 0 : 1] ?? null,
              sum,
            );
            sum = 0; n = 0; bloque++;
            continue;
          }
          const r = splitRow(lines[j]);
          if (!r) continue;
          // El % va último: si el último token es < 100 es el porcentaje.
          const vals = [...r.valores];
          let pct: number | null = null;
          if (vals.length && vals[vals.length - 1] < 100) pct = vals.pop()!;
          if (!vals.length) continue;
          const flota = bloque === 1 ? flotaSeccion : flotaResuelta(r.nombre, flotaSeccion);
          const f = filaDe(flota, r.nombre);
          let km100: number;
          let km: number | undefined;
          if (vals.length >= 2) {
            km100 = km100Primero ? vals[0] : vals[1];
            km = km100Primero ? vals[1] : vals[0];
          } else if (pct === 0 || casiIgual(vals[0], f.km)) {
            km100 = 0; // % en 0 → la celda del "al 100" está vacía; el valor es el km
            km = vals[0];
          } else {
            km100 = vals[0];
          }
          f.km100 = km100;
          f.km = f.km ?? km;
          sum += km100; n++;
        }
      });
    }
  }

  // 4) TONELADAS (escal 35 / escal 37 / tolvas)
  {
    const lines = leer(/^toneladas/i);
    if (!lines) warnings.push("Falta toneladas*.txt");
    else {
      const headers = marcas(lines, /TONELADAS TOTALES/i);
      headers.forEach((h, i) => {
        const fin = headers[i + 1] ?? lines.length;
        const esTolvas = /TOLVAS/i.test(lines[h]);
        let escalTipo: 35 | 37 | undefined;
        for (let j = h; j < Math.min(h + 4, fin); j++) {
          const m = lines[j].match(/ESCAL\s*(35|37)/i);
          if (m) { escalTipo = Number(m[1]) as 35 | 37; break; }
        }
        const flota = esTolvas ? "tolvas" : "escalables";
        let n = 0;
        for (let j = h + 1; j < fin; j++) {
          const r = splitRow(lines[j]);
          if (!r || r.valores.length < 2) continue;
          const f = filaDe(flota, r.nombre);
          f.toneladas = r.valores[1];
          if (!esTolvas && escalTipo) f.escalTipo = escalTipo;
          n++;
        }
        checks.push(`✓ toneladas ${flota}${escalTipo ? ` escal ${escalTipo}` : ""}: ${n} filas`);
      });
    }
  }

  // 5) SUELDO SOBRE FACTURACION — columnas: FACTURACION $ · SUELDO TOTAL ·
  //    SUELDO NETO · %. El formato viejo (2024) trae UN header y VARIOS
  //    grupos delimitados por filas TOTAL, sin decir la flota: los grupos se
  //    detectan por los TOTAL y la flota de cada chofer se deduce de fact-km
  //    (que ya corrió). Celdas vacías → asignación por valor ancla.
  {
    const lines = leer(/^sueldo-fact/i);
    if (!lines) warnings.push("Falta sueldo-fact*.txt");
    else {
      const corte = lines.findIndex((l) => /RETENCIONES/i.test(l));
      const utiles = (corte >= 0 ? lines.slice(0, corte) : lines).map((l) => l.replace(/\f/g, " "));
      type Bloque = { rows: { nombre: string; vals: number[]; pos: number[] }[]; total: number[] | null };
      const bloques: Bloque[] = [{ rows: [], total: null }];
      // Posiciones de las columnas según el último header visto (para resolver
      // filas con una sola celda cargada, ej. solo el neto).
      let anclas: { fact: number; total: number; neto: number } | null = null;
      for (const l of utiles) {
        if (/FACTURACION \$/.test(l)) {
          anclas = {
            fact: l.indexOf("FACTURACION $"),
            total: l.indexOf("SUELDO TOTAL"),
            neto: l.indexOf("SUELDO NETO"),
          };
          continue;
        }
        if (/^\s*TOTAL\s/.test(l)) {
          bloques[bloques.length - 1].total = (l.match(/\$?\s?[\d.]+(?:,\d+)?/g) ?? []).map(num);
          bloques.push({ rows: [], total: null });
          continue;
        }
        const r = splitRow(l);
        if (!r) continue;
        const vals: number[] = [];
        const pos: number[] = [];
        r.valores.forEach((v, i) => {
          if (v >= 1000) { // el % no es plata
            vals.push(v);
            pos.push(r.pos[i]);
          }
        });
        if (vals.length) bloques[bloques.length - 1].rows.push({ nombre: r.nombre, vals, pos });
      }
      const anclasFinal = anclas;

      for (const b of bloques.filter((x) => x.rows.length)) {
        let sumFact = 0, sumTotal = 0;
        const flotas = { escalables: 0, tolvas: 0 };
        for (const { nombre, vals, pos } of b.rows) {
          // Flota: la que ya conocemos de fact-km (dominante si cambió de
          // flota a mitad de mes); si no está, la mayoría del bloque decide.
          const enEsc = filas.has(`escalables|${nombre}`);
          const enTol = filas.has(`tolvas|${nombre}`);
          const flota = enEsc || enTol ? flotaResuelta(nombre, "escalables") : null;
          if (flota) flotas[flota]++;
          const anclaFact = flota ? filas.get(`${flota}|${nombre}`)!.facturacion : undefined;
          let fact: number | null = null, total: number | null = null, neto: number | null = null;
          if (vals.length >= 3) {
            [fact, total, neto] = vals;
          } else if (vals.length === 2) {
            // ¿[fact, total] (falta neto) o [total, neto] (falta fact)? Anclas:
            // la facturación de fact-km, o la proporción (fact ≫ sueldo).
            if (casiIgual(vals[0], anclaFact) || vals[0] / vals[1] > 2.5) [fact, total] = vals;
            else [total, neto] = vals;
          } else if (casiIgual(vals[0], anclaFact)) {
            fact = vals[0];
          } else if (anclasFinal) {
            // Una sola celda cargada: decide la columna más cercana del header.
            const dist = {
              fact: Math.abs(pos[0] - anclasFinal.fact),
              total: Math.abs(pos[0] - anclasFinal.total),
              neto: Math.abs(pos[0] - anclasFinal.neto),
            };
            if (dist.neto <= dist.total && dist.neto <= dist.fact) neto = vals[0];
            else if (dist.total <= dist.fact) total = vals[0];
            else fact = vals[0];
          } else {
            total = vals[0];
          }
          sumFact += fact ?? 0;
          sumTotal += total ?? 0;
          b.rows.find((x) => x.nombre === nombre)!.vals = [fact ?? NaN, total ?? NaN, neto ?? NaN];
        }
        // Flota del bloque = mayoría (para los choferes que fact-km no trae).
        const flotaBloque = flotas.tolvas > flotas.escalables ? "tolvas" : "escalables";
        for (const { nombre, vals } of b.rows) {
          const flota = flotaResuelta(nombre, flotaBloque);
          const f = filaDe(flota, nombre);
          if (!Number.isNaN(vals[0])) f.facturacion = f.facturacion ?? vals[0];
          if (!Number.isNaN(vals[1])) f.sueldoTotal = vals[1];
          if (!Number.isNaN(vals[2])) f.sueldoNeto = vals[2];
        }
        checkTotal(
          `sueldo-fact ${flotaBloque} facturación (${b.rows.length} filas)`,
          b.total?.[0] ?? null,
          sumFact,
        );
        checkTotal(`sueldo-fact ${flotaBloque} sueldo total`, b.total?.[1] ?? null, sumTotal);
      }
    }
  }

  // 6) COSTO VS KM (tabla mensual del año)
  {
    const lines = leer(/^costo-km/i);
    if (!lines) warnings.push("Falta costo-km*.txt");
    else {
      let n = 0;
      for (const l of lines) {
        const m = l.trim().match(/^(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)-(\d{2})\s+(.+)$/i);
        if (!m) continue;
        const vals = (m[3].match(/\$?\s?[\d.]+(?:,\d+)?/g) ?? []).map(num);
        if (vals.length < 2) continue;
        mesesRows.push({
          mes: `20${m[2]}-${MESES_ABREV[m[1].toLowerCase()]}-01`,
          flota: null,
          factKm: vals[0],
          costoKm: vals[1],
          promKm: vals[2],
          fuente: "planillas",
        });
        n++;
      }
      checks.push(`✓ costo-km: ${n} meses con datos`);
    }
  }

  // 7) Anuales históricos (*anual<AÑO>*: km + facturación por mes y flota)
  for (const f of readdirSync(dir).filter((x) => /anual(\d{4})/i.test(x) && x.endsWith(".txt"))) {
    const anio = f.match(/anual(\d{4})/i)![1];
    const lines = readFileSync(join(dir, f), "utf8").split("\n");
    let flota: string | null = null;
    let n = 0;
    for (const l of lines) {
      const fm = l.match(/^\s*(ESCALABLES|TOLVAS)\s+KM/i);
      if (fm) { flota = fm[1].toLowerCase(); continue; }
      const m = l.trim().match(/^([A-Z]+)\s{2,}(.+)$/);
      if (!m || !MES_NOMBRE[m[1]] || !flota) continue;
      const vals = (m[2].match(/\$?\s?[\d.]+(?:,\d+)?/g) ?? []).map(num);
      if (vals.length < 2) continue;
      mesesRows.push({
        mes: `${anio}-${MES_NOMBRE[m[1]]}-01`,
        flota,
        km: vals[0],
        facturacion: vals[1],
        factKm: vals[2],
        fuente: "anual_historico",
      });
      n++;
    }
    checks.push(`✓ anual ${anio}: ${n} filas mes×flota`);
  }

  // Consistencia entre planillas.
  for (const f of filas.values()) {
    const faltan = (["km", "kmVacios", "km100", "facturacion", "sueldoTotal", "toneladas"] as const)
      .filter((k) => f[k] == null);
    if (faltan.length) warnings.push(`${f.flota}/${f.nombre}: falta ${faltan.join(", ")}`);
  }

  // Guard anti-skip silencioso: si una planilla por chofer existe pero NINGUNA
  // fila aportó su métrica, casi seguro cambió el formato del header → se
  // bloquea el mes (mismatch) en vez de cargarlo incompleto sin aviso.
  if (filas.size) {
    const todas = Array.from(filas.values());
    const chequeos: [RegExp, keyof FilaChofer, string][] = [
      [/^fact-km(?!.*anual)/i, "km", "fact-km"],
      [/^km-vacios/i, "kmVacios", "km-vacios"],
      [/^km-100/i, "km100", "km-100"],
      [/^toneladas/i, "toneladas", "toneladas"],
      [/^sueldo-fact/i, "sueldoTotal", "sueldo-fact"],
    ];
    for (const [patron, campo, nombre] of chequeos) {
      const existe = readdirSync(dir).some((x) => patron.test(x) && x.endsWith(".txt"));
      if (existe && todas.every((f) => f[campo] == null)) {
        mismatch = true;
        warnings.push(`${nombre}: el archivo existe pero no se parseó NINGUNA fila (¿header nuevo?) — mes bloqueado`);
      }
    }
  }

  return { mes: mesISO, filas: Array.from(filas.values()), mesesRows, checks, warnings, mismatch };
}

/** SQL idempotente de un ParseResult (para el CLI / aplicar por MCP). */
export function generarSQL(r: ParseResult): string {
  const esc = (v: number | null | undefined) => (v == null ? "null" : String(v));
  const escTxt = (s: string) => s.replace(/'/g, "''");
  const choferValues = r.filas.map((f) =>
    `('${r.mes}', '${f.flota}', '${escTxt(f.nombre)}', ${f.escalTipo ?? "null"}, ${esc(f.km)}, ${esc(f.kmVacios)}, ${esc(f.km100)}, ${esc(f.facturacion)}, ${esc(f.sueldoTotal)}, ${esc(f.sueldoNeto)}, ${esc(f.toneladas)}, ${f.ingresoParcial})`,
  );
  const mesValues = r.mesesRows.map((m) =>
    `('${m.mes}', ${m.flota ? `'${m.flota}'` : "null"}, ${esc(m.km)}, ${esc(m.facturacion)}, ${esc(m.factKm)}, ${esc(m.costoKm)}, ${esc(m.promKm)}, '${m.fuente}')`,
  );
  return `-- Carga de métricas ${r.mes} generada por parse-planillas-metricas.ts. Idempotente.
${choferValues.length ? `insert into public.metricas_chofer_mes
  (mes, flota, chofer_nombre, escal_tipo, km_totales, km_vacios, km_100, facturacion, sueldo_total, sueldo_neto, toneladas_prom, ingreso_parcial)
values
${choferValues.join(",\n")}
on conflict (mes, flota, chofer_nombre) do update set
  escal_tipo = excluded.escal_tipo, km_totales = excluded.km_totales,
  km_vacios = excluded.km_vacios, km_100 = excluded.km_100,
  facturacion = excluded.facturacion, sueldo_total = excluded.sueldo_total,
  sueldo_neto = excluded.sueldo_neto, toneladas_prom = excluded.toneladas_prom,
  ingreso_parcial = excluded.ingreso_parcial;` : ""}

${mesValues.length ? `insert into public.metricas_mes (mes, flota, km, facturacion, fact_km, costo_km_estudio, prom_km, fuente)
values
${mesValues.join(",\n")}
on conflict (mes, coalesce(flota, '-')) do update set
  km = excluded.km, facturacion = excluded.facturacion, fact_km = excluded.fact_km,
  costo_km_estudio = excluded.costo_km_estudio, prom_km = excluded.prom_km, fuente = excluded.fuente;` : ""}
`;
}

// ── CLI ────────────────────────────────────────────────────────────────────
if (process.argv[1]?.includes("parse-planillas-metricas")) {
  const [dir, mesArg, ...rest] = process.argv.slice(2);
  if (!dir || !/^\d{4}-\d{2}$/.test(mesArg ?? "")) {
    console.error("Uso: tsx scripts/parse-planillas-metricas.ts <dir-txts> <YYYY-MM> [--parciales A,B]");
    process.exit(1);
  }
  const parcialesIdx = rest.indexOf("--parciales");
  const parciales = new Set(
    parcialesIdx >= 0 ? (rest[parcialesIdx + 1] ?? "").split(",").map((s) => s.trim().toUpperCase()) : [],
  );
  const r = parsePlanillasDir(dir, `${mesArg}-01`, parciales);
  console.log("=== CHEQUEOS ===");
  r.checks.forEach((c) => console.log(c));
  console.log(`\nFilas chofer×mes: ${r.filas.length}`);
  if (r.warnings.length) {
    console.log("\n=== WARNINGS ===");
    r.warnings.forEach((w) => console.log("⚠️ ", w));
  }
  const out = rest.find((x) => x.endsWith(".sql")) ?? join(dir, `carga-metricas-${mesArg}.sql`);
  writeFileSync(out, generarSQL(r));
  console.log(`\nSQL → ${out} (${r.filas.length} filas chofer + ${r.mesesRows.length} filas mes)`);
}
