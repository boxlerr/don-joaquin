/**
 * Parser de las 6 planillas mensuales de gestión (PDFs del Drive de Bárbara)
 * → SQL idempotente para `metricas_chofer_mes` / `metricas_mes`.
 *
 * Pipeline: descargar los PDFs del mes, pasarlos por `pdftotext -layout` y
 * correr este script sobre la carpeta con los .txt:
 *
 *   pdftotext -layout "SUELDO SOBRE FACTURACION MAYO 2026.pdf" sueldo-fact.txt
 *   ... (fact-km / costo-km / km-vacios / km-100 / toneladas)
 *   npx tsx scripts/parse-planillas-metricas.ts <dir> 2026-05 --parciales GOMEZ,CLEMENTE
 *
 * Reconoce los archivos por nombre: sueldo-fact*, fact-km*, costo-km*,
 * km-vacios*, km-100*, toneladas*, y opcionalmente *anual<AÑO>* (planilla
 * anual km+facturación por mes, sin choferes).
 *
 * Verifica las sumas contra las filas TOTAL de cada planilla y las reporta:
 * si algo no cierra, NO aplicar el SQL sin mirar.
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

type Fila = {
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
};

const [dir, mesArg, ...rest] = process.argv.slice(2);
if (!dir || !/^\d{4}-\d{2}$/.test(mesArg ?? "")) {
  console.error("Uso: tsx scripts/parse-planillas-metricas.ts <dir-txts> <YYYY-MM> [--parciales A,B]");
  process.exit(1);
}
const MES = `${mesArg}-01`;
const parcialesIdx = rest.indexOf("--parciales");
const PARCIALES = new Set(
  parcialesIdx >= 0 ? (rest[parcialesIdx + 1] ?? "").split(",").map((s) => s.trim().toUpperCase()) : [],
);

// ── helpers ────────────────────────────────────────────────────────────────
const num = (s: string): number => {
  const clean = s.replace(/[$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(clean);
  if (!Number.isFinite(n)) throw new Error(`No es número: "${s}"`);
  return n;
};
/** Separa "NOMBRE   12.345  $ 678,90 ..." en { nombre, valores[] }. */
function splitRow(line: string): { nombre: string; valores: number[] } | null {
  const m = line.trim().match(/^([A-ZÑÁÉÍÓÚ][A-ZÑÁÉÍÓÚ.\s]*?)\s{2,}(.+)$/);
  if (!m) return null;
  const nombre = m[1].trim().replace(/\s+/g, " ");
  if (/TOTAL|PROMEDIO|CHOFER|MESES|FACTURACI|SUELDO|KM|TONELADAS|ESCAL|TOLVAS/.test(nombre)) return null;
  const valores = (m[2].match(/\$?\s?-?[\d.]+(?:,\d+)?/g) ?? []).map(num);
  if (!valores.length) return null;
  return { nombre, valores };
}
const filas = new Map<string, Fila>();
const filaDe = (flota: Fila["flota"], nombre: string): Fila => {
  const key = `${flota}|${nombre}`;
  if (!filas.has(key)) filas.set(key, { flota, nombre });
  return filas.get(key)!;
};
const warnings: string[] = [];
const checks: string[] = [];
function checkTotal(tag: string, esperado: number | null, real: number) {
  if (esperado == null) return;
  const ok = Math.abs(esperado - real) <= 1.5;
  checks.push(`${ok ? "✓" : "✗ MISMATCH"} ${tag}: planilla=${esperado} calculado=${Math.round(real * 100) / 100}`);
  if (!ok) warnings.push(`Suma que no cierra en ${tag}`);
}
/** Números de la fila TOTAL de una sección (o null). */
function totalDe(lines: string[], desde: number, hasta: number): number[] | null {
  for (let i = desde; i < hasta; i++) {
    if (/^\s*TOTAL\s/.test(lines[i])) return (lines[i].match(/\$?\s?[\d.]+(?:,\d+)?/g) ?? []).map(num);
  }
  return null;
}
const leer = (patron: RegExp): string[] | null => {
  const f = readdirSync(dir).find((x) => patron.test(x) && x.endsWith(".txt"));
  return f ? readFileSync(join(dir, f), "utf8").split("\n") : null;
};
/** Índices de líneas que matchean (para delimitar secciones). */
const marcas = (lines: string[], re: RegExp): number[] =>
  lines.map((l, i) => (re.test(l) ? i : -1)).filter((i) => i >= 0);

// ── 1) FACTURACION POR KM (mensual, por chofer) ────────────────────────────
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

// ── 2) KM VACIOS ───────────────────────────────────────────────────────────
{
  const lines = leer(/^km-vacios/i);
  if (!lines) warnings.push("Falta km-vacios*.txt");
  else {
    const headers = marcas(lines, /KM VACIO\S*\s+(ESCALABLES|TOLVAS)/i);
    headers.forEach((h, i) => {
      const flota = /TOLVAS/i.test(lines[h]) ? "tolvas" : "escalables";
      const fin = headers[i + 1] ?? lines.length;
      let sum = 0, n = 0;
      for (let j = h + 1; j < fin; j++) {
        const r = splitRow(lines[j]);
        if (!r || r.valores.length < 3) continue;
        filaDe(flota, r.nombre).kmVacios = r.valores[1];
        sum += r.valores[1]; n++;
      }
      const tot = totalDe(lines, h, fin);
      checkTotal(`km-vacios ${flota} (${n} filas)`, tot?.[1] ?? null, sum);
    });
  }
}

// ── 3) KM AL 100% ──────────────────────────────────────────────────────────
{
  const lines = leer(/^km-100/i);
  if (!lines) warnings.push("Falta km-100*.txt");
  else {
    const headers = marcas(lines, /(ESCALABLES|TOLVAS)\s+KM TOTALES/i);
    headers.forEach((h, i) => {
      const flota = /TOLVAS/i.test(lines[h]) ? "tolvas" : "escalables";
      const fin = headers[i + 1] ?? lines.length;
      let sum = 0, n = 0;
      for (let j = h + 1; j < fin; j++) {
        const r = splitRow(lines[j]);
        if (!r || r.valores.length < 2) continue;
        // 3 valores = km, km100, %; 2 valores = km y % (km100 vacío → 0).
        const km100 = r.valores.length >= 3 ? r.valores[1] : 0;
        filaDe(flota, r.nombre).km100 = km100;
        sum += km100; n++;
      }
      const tot = totalDe(lines, h, fin);
      checkTotal(`km-100 ${flota} (${n} filas)`, tot?.[1] ?? null, sum);
    });
  }
}

// ── 4) TONELADAS (escal 35 / escal 37 / tolvas) ────────────────────────────
{
  const lines = leer(/^toneladas/i);
  if (!lines) warnings.push("Falta toneladas*.txt");
  else {
    const headers = marcas(lines, /TONELADAS TOTALES/i);
    headers.forEach((h, i) => {
      const fin = headers[i + 1] ?? lines.length;
      const esTolvas = /TOLVAS/i.test(lines[h]);
      // El tipo (35/37) viene en la línea de columnas "CHOFER  KM  ESCAL 35".
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

// ── 5) SUELDO SOBRE FACTURACION ────────────────────────────────────────────
{
  const lines = leer(/^sueldo-fact/i);
  if (!lines) warnings.push("Falta sueldo-fact*.txt");
  else {
    // Cortar en la primera página de RETENCIONES (detalle que no va acá).
    const corte = lines.findIndex((l) => /RETENCIONES/i.test(l));
    const utiles = corte >= 0 ? lines.slice(0, corte) : lines;
    const headers = marcas(utiles, /CHOFER\s+FACTURACION \$/i);
    headers.forEach((h, i) => {
      const flota = i === 0 ? "escalables" : "tolvas"; // orden de la planilla
      const fin = headers[i + 1] ?? utiles.length;
      let sumFact = 0, sumTotal = 0, n = 0;
      for (let j = h + 1; j < fin; j++) {
        const r = splitRow(utiles[j]);
        if (!r || r.valores.length < 4) continue;
        const f = filaDe(flota, r.nombre);
        f.facturacion = f.facturacion ?? r.valores[0];
        f.sueldoTotal = r.valores[1];
        f.sueldoNeto = r.valores[2];
        sumFact += r.valores[0]; sumTotal += r.valores[1]; n++;
      }
      const tot = totalDe(utiles, h, fin);
      checkTotal(`sueldo-fact ${flota} facturación (${n} filas)`, tot?.[0] ?? null, sumFact);
      checkTotal(`sueldo-fact ${flota} sueldo total`, tot?.[1] ?? null, sumTotal);
    });
  }
}

// ── 6) COSTO VS KM (tabla mensual del año) ─────────────────────────────────
const MESES_ABREV: Record<string, string> = {
  ene: "01", feb: "02", mar: "03", abr: "04", may: "05", jun: "06",
  jul: "07", ago: "08", sept: "09", sep: "09", oct: "10", nov: "11", dic: "12",
};
const mesesRows: { mes: string; flota: string | null; km?: number; facturacion?: number; factKm?: number; costoKm?: number; promKm?: number; fuente: string }[] = [];
{
  const lines = leer(/^costo-km/i);
  if (!lines) warnings.push("Falta costo-km*.txt");
  else {
    for (const l of lines) {
      const m = l.trim().match(/^(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)-(\d{2})\s+(.+)$/i);
      if (!m) continue;
      const vals = (m[3].match(/\$?\s?[\d.]+(?:,\d+)?/g) ?? []).map(num);
      if (vals.length < 2) continue; // mes sin datos
      mesesRows.push({
        mes: `20${m[2]}-${MESES_ABREV[m[1].toLowerCase()]}-01`,
        flota: null,
        factKm: vals[0],
        costoKm: vals[1],
        promKm: vals[2],
        fuente: "planillas",
      });
    }
    checks.push(`✓ costo-km: ${mesesRows.length} meses con datos`);
  }
}

// ── 7) Anuales históricos (opcional: *anual<AÑO>*) ─────────────────────────
{
  const f = readdirSync(dir).find((x) => /anual(\d{4})/i.test(x) && x.endsWith(".txt"));
  if (f) {
    const anio = f.match(/anual(\d{4})/i)![1];
    const lines = readFileSync(join(dir, f), "utf8").split("\n");
    const MES_NOMBRE: Record<string, string> = {
      ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04", MAYO: "05", JUNIO: "06",
      JULIO: "07", AGOSTO: "08", SEPTIEMBRE: "09", OCTUBRE: "10", NOVIEMBRE: "11", DICIEMBRE: "12",
    };
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
}

// ── Reporte + SQL ──────────────────────────────────────────────────────────
console.log("=== CHEQUEOS ===");
checks.forEach((c) => console.log(c));
console.log(`\nFilas chofer×mes: ${filas.size}`);
// Consistencia entre planillas: choferes a los que les falta alguna métrica.
for (const f of filas.values()) {
  const faltan = (["km", "kmVacios", "km100", "facturacion", "sueldoTotal", "toneladas"] as const)
    .filter((k) => f[k] == null);
  if (faltan.length) warnings.push(`${f.flota}/${f.nombre}: falta ${faltan.join(", ")}`);
}
if (warnings.length) {
  console.log("\n=== WARNINGS ===");
  warnings.forEach((w) => console.log("⚠️ ", w));
}

const esc = (v: number | null | undefined) => (v == null ? "null" : String(v));
const escTxt = (s: string) => s.replace(/'/g, "''");
const choferValues = Array.from(filas.values()).map((f) =>
  `('${MES}', '${f.flota}', '${escTxt(f.nombre)}', ${f.escalTipo ?? "null"}, ${esc(f.km)}, ${esc(f.kmVacios)}, ${esc(f.km100)}, ${esc(f.facturacion)}, ${esc(f.sueldoTotal)}, ${esc(f.sueldoNeto)}, ${esc(f.toneladas)}, ${PARCIALES.has(f.nombre.toUpperCase())})`,
);
const mesValues = mesesRows.map((r) =>
  `('${r.mes}', ${r.flota ? `'${r.flota}'` : "null"}, ${esc(r.km)}, ${esc(r.facturacion)}, ${esc(r.factKm)}, ${esc(r.costoKm)}, ${esc(r.promKm)}, '${r.fuente}')`,
);

const sql = `-- Carga de métricas ${MES} generada por parse-planillas-metricas.ts. Idempotente.
insert into public.metricas_chofer_mes
  (mes, flota, chofer_nombre, escal_tipo, km_totales, km_vacios, km_100, facturacion, sueldo_total, sueldo_neto, toneladas_prom, ingreso_parcial)
values
${choferValues.join(",\n")}
on conflict (mes, flota, chofer_nombre) do update set
  escal_tipo = excluded.escal_tipo, km_totales = excluded.km_totales,
  km_vacios = excluded.km_vacios, km_100 = excluded.km_100,
  facturacion = excluded.facturacion, sueldo_total = excluded.sueldo_total,
  sueldo_neto = excluded.sueldo_neto, toneladas_prom = excluded.toneladas_prom,
  ingreso_parcial = excluded.ingreso_parcial;

${mesValues.length ? `insert into public.metricas_mes (mes, flota, km, facturacion, fact_km, costo_km_estudio, prom_km, fuente)
values
${mesValues.join(",\n")}
on conflict (mes, coalesce(flota, '-')) do update set
  km = excluded.km, facturacion = excluded.facturacion, fact_km = excluded.fact_km,
  costo_km_estudio = excluded.costo_km_estudio, prom_km = excluded.prom_km, fuente = excluded.fuente;` : ""}

-- Linkeo best-effort chofer_nombre → chofer_id (solo matches inequívocos).
update public.metricas_chofer_mes m
set chofer_id = sub.id
from (
  select m2.id as mid, (
    select c.id from public.choferes c
    where c.rol = 'chofer'
      and (
        upper(c.apellido) = m2.chofer_nombre
        or (
          upper(c.apellido) = split_part(m2.chofer_nombre, ' ', 1)
          and split_part(m2.chofer_nombre, ' ', 2) <> ''
          and upper(c.nombre) like split_part(m2.chofer_nombre, ' ', 2) || '%'
        )
      )
    limit 1
  ) as id
  from public.metricas_chofer_mes m2
  where m2.mes = '${MES}' and m2.chofer_id is null
    and (
      select count(*) from public.choferes c
      where c.rol = 'chofer'
        and (
          upper(c.apellido) = m2.chofer_nombre
          or (
            upper(c.apellido) = split_part(m2.chofer_nombre, ' ', 1)
            and split_part(m2.chofer_nombre, ' ', 2) <> ''
            and upper(c.nombre) like split_part(m2.chofer_nombre, ' ', 2) || '%'
          )
        )
    ) = 1
) sub
where m.id = sub.mid and sub.id is not null;
`;

const out = rest.find((r) => r.endsWith(".sql")) ?? join(dir, `carga-metricas-${mesArg}.sql`);
writeFileSync(out, sql);
console.log(`\nSQL → ${out} (${choferValues.length} filas chofer + ${mesValues.length} filas mes)`);
if (!existsSync(out)) process.exit(1);
