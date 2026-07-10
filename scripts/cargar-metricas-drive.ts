/**
 * Carga masiva de las planillas de métricas desde el Drive de Bárbara.
 *
 *   npx tsx --env-file=.env scripts/cargar-metricas-drive.ts [--dir DIR] [--apply] [--solo 2025]
 *
 * 1. Enumera el Drive público (embeddedfolderview) recursivamente:
 *    raíz → carpetas por año (2023…) → carpetas por mes ("ENERO 2025") → PDFs.
 * 2. Descarga cada PDF (uc?export=download), lo clasifica por nombre y lo pasa
 *    por `pdftotext -layout` (requiere poppler: `brew install poppler`).
 * 3. Parsea cada mes con parse-planillas-metricas y VERIFICA los totales.
 * 4. Sin --apply es un dry-run (solo reporte). Con --apply upsertea en
 *    metricas_chofer_mes / metricas_mes vía service role y linkea chofer_id.
 *
 * Idempotente y reanudable: los PDFs ya bajados no se re-descargan, y los
 * upserts pisan por clave única. Los meses con MISMATCH de totales NO se
 * aplican (quedan listados para revisar a mano).
 */
import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { parsePlanillasDir, type ParseResult } from "./parse-planillas-metricas";

const ROOT_FOLDER = "1r2hdlfhOIrzEz6lloM_oNXeNxxUtWkI6";
const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dirIdx = args.indexOf("--dir");
const BASE = dirIdx >= 0 ? args[dirIdx + 1] : join(process.cwd(), ".metricas-drive");
const soloIdx = args.indexOf("--solo");
const SOLO = soloIdx >= 0 ? args[soloIdx + 1] : null;
// Choferes que entraron/salieron a mitad de mes (cursiva en la planilla) — por mes.
const PARCIALES: Record<string, string[]> = { "2026-05": ["GOMEZ", "CLEMENTE"] };

const MES_NOMBRE: Record<string, string> = {
  ENERO: "01", FEBRERO: "02", MARZO: "03", ABRIL: "04", MAYO: "05", JUNIO: "06",
  JULIO: "07", AGOSTO: "08", SEPTIEMBRE: "09", OCTUBRE: "10", NOVIEMBRE: "11", DICIEMBRE: "12",
};

const sh = (cmd: string) => execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reintentos con backoff para las ráfagas que Google corta. */
async function conReintentos<T>(fn: () => Promise<T> | T, intentos = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= intentos) throw e;
      await dormir(1500 * i);
    }
  }
}

/** Lista una carpeta pública del Drive: [{id, nombre, esCarpeta}]. */
async function listarCarpeta(folderId: string): Promise<{ id: string; nombre: string; esCarpeta: boolean }[]> {
  const html = await conReintentos(async () => {
    const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${folderId}#list`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  });
  await dormir(400); // no rafaguear a Google
  const out: { id: string; nombre: string; esCarpeta: boolean }[] = [];
  const re = /<div class="flip-entry"[\s\S]*?id="entry-([\w-]+)"[\s\S]*?flip-entry-title">([^<]*)</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    // Las carpetas linkean a /drive/folders/<id>; los archivos a /file/d/<id>.
    const esCarpeta = html.includes(`folders/${m[1]}`);
    out.push({ id: m[1], nombre: m[2].trim(), esCarpeta });
  }
  return out;
}

const norm = (s: string) =>
  s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

/** Clasifica un PDF por nombre → base del .txt esperado por el parser (o null). */
function clasificar(nombre: string): string | null {
  const n = norm(nombre);
  const anio = n.match(/(?:ANO|AÑO|ANUAL)\D*(\d{4})/) ?? n.match(/(\d{4})/);
  if (/SUELDO/.test(n)) return "sueldo-fact";
  if (/COSTO/.test(n)) return "costo-km";
  if (/VACIO/.test(n)) return "km-vacios";
  if (/100/.test(n)) return "km-100";
  if (/TONELA/.test(n)) return "toneladas";
  if (/FACTURACION POR KM/.test(n)) {
    return /ANO|AÑO|ANUAL/.test(n) ? `fact-km-anual${anio?.[1] ?? ""}` : "fact-km";
  }
  return null;
}

const esPdf = (p: string) => {
  try {
    return sh(`head -c 8 "${p}" | cat -v`).includes("%PDF");
  } catch {
    return false;
  }
};

async function descargar(fileId: string, destino: string) {
  if (existsSync(destino) && statSync(destino).size > 1000 && esPdf(destino)) return; // reanudable
  await conReintentos(() => {
    sh(`curl -sfL --retry 3 --retry-delay 2 "https://drive.google.com/uc?export=download&id=${fileId}" -o "${destino}"`);
    const head = sh(`head -c 8 "${destino}" | cat -v`);
    if (!head.includes("%PDF")) throw new Error(`Descarga no-PDF: ${destino}`);
  });
}

async function main() {
  mkdirSync(BASE, { recursive: true });
  const noClasificados: string[] = [];

  // ── 1+2) Enumerar y descargar ───────────────────────────────────────────
  console.log("Enumerando Drive…");
  const anios = (await listarCarpeta(ROOT_FOLDER)).filter((e) => e.esCarpeta);
  const mesesDirs: { mesISO: string; dir: string }[] = [];

  for (const anio of anios) {
    if (SOLO && anio.nombre !== SOLO) continue;
    const entradas = await listarCarpeta(anio.id);
    for (const carpeta of entradas.filter((e) => e.esCarpeta)) {
      const n = norm(carpeta.nombre);
      const esAnuales = /ANUAL/.test(n);
      const mesToken = Object.keys(MES_NOMBRE).find((k) => n.startsWith(k));
      const anioToken = n.match(/(\d{4})/)?.[1] ?? anio.nombre;
      if (!esAnuales && !mesToken) {
        console.log(`  ⚠️ Carpeta no reconocida: ${anio.nombre}/${carpeta.nombre}`);
        continue;
      }
      // Las planillas anuales van al dir de diciembre-ficticio del año (solo
      // aportan filas de metricas_mes; el parser las toma por *anualYYYY*).
      const mesISO = esAnuales ? `${anioToken}-12` : `${anioToken}-${MES_NOMBRE[mesToken!]}`;
      const dir = join(BASE, anioToken, esAnuales ? "anuales" : mesISO);
      mkdirSync(dir, { recursive: true });

      const archivos = (await listarCarpeta(carpeta.id)).filter((e) => !e.esCarpeta);
      for (const a of archivos) {
        const clase = clasificar(a.nombre);
        if (!clase) {
          noClasificados.push(`${anio.nombre}/${carpeta.nombre}/${a.nombre}`);
          continue;
        }
        const pdf = join(dir, `${clase}.pdf`);
        try {
          await descargar(a.id, pdf);
          const txt = pdf.replace(/\.pdf$/, ".txt");
          if (!existsSync(txt)) sh(`pdftotext -layout "${pdf}" "${txt}"`);
        } catch (e) {
          console.log(`  ⚠️ Error bajando ${a.nombre}: ${(e as Error).message}`);
        }
      }
      if (!esAnuales) mesesDirs.push({ mesISO, dir });
      else mesesDirs.push({ mesISO: `${anioToken}-ANUAL`, dir });
      console.log(`  ✓ ${anio.nombre}/${carpeta.nombre} (${archivos.length} archivos)`);
    }
  }

  // ── 3) Parsear y verificar ─────────────────────────────────────────────
  const resultados: ParseResult[] = [];
  const conMismatch: string[] = [];
  for (const { mesISO, dir } of mesesDirs.sort((a, b) => a.mesISO.localeCompare(b.mesISO))) {
    const esAnual = mesISO.endsWith("-ANUAL");
    const mes = esAnual ? `${mesISO.slice(0, 4)}-12-01` : `${mesISO}-01`;
    const parciales = new Set((PARCIALES[mesISO] ?? []).map((s) => s.toUpperCase()));
    const r = parsePlanillasDir(dir, mes, parciales);
    if (esAnual) r.filas = []; // las carpetas ANUALES no traen choferes del mes
    resultados.push(r);
    const malas = r.checks.filter((c) => c.startsWith("✗"));
    const faltantes = r.warnings.filter((w) => w.startsWith("Falta")).length;
    console.log(
      `${r.mismatch ? "✗" : "✓"} ${mesISO}: ${r.filas.length} choferes · ${r.mesesRows.length} filas-mes · ${faltantes ? `${faltantes} planillas faltantes · ` : ""}${r.warnings.length} warnings`,
    );
    malas.forEach((c) => console.log(`    ${c}`));
    if (r.mismatch) conMismatch.push(mesISO);
  }
  if (noClasificados.length) {
    console.log(`\n⚠️ Archivos sin clasificar (${noClasificados.length}):`);
    noClasificados.forEach((x) => console.log("  -", x));
  }

  const totalChoferes = resultados.reduce((s, r) => s + r.filas.length, 0);
  console.log(`\nTOTAL: ${resultados.length} carpetas · ${totalChoferes} filas chofer×mes · mismatches: ${conMismatch.length ? conMismatch.join(", ") : "ninguno"}`);

  if (!APPLY) {
    console.log("\nDry-run (sin --apply): no se escribió nada.");
    return;
  }

  // ── 4) Aplicar ─────────────────────────────────────────────────────────
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (usar --env-file=.env).");
    process.exit(1);
  }
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });

  for (const r of resultados) {
    if (r.mismatch) {
      console.log(`⏭️  ${r.mes}: SALTEADO por mismatch de totales — revisar a mano.`);
      continue;
    }
    if (r.filas.length) {
      const rows = r.filas.map((f) => ({
        mes: r.mes,
        flota: f.flota,
        chofer_nombre: f.nombre,
        escal_tipo: f.escalTipo ?? null,
        km_totales: f.km ?? null,
        km_vacios: f.kmVacios ?? null,
        km_100: f.km100 ?? null,
        facturacion: f.facturacion ?? null,
        sueldo_total: f.sueldoTotal ?? null,
        sueldo_neto: f.sueldoNeto ?? null,
        toneladas_prom: f.toneladas ?? null,
        ingreso_parcial: f.ingresoParcial,
      }));
      const { error } = await sb.from("metricas_chofer_mes").upsert(rows, { onConflict: "mes,flota,chofer_nombre" });
      if (error) {
        console.error(`✗ ${r.mes} choferes:`, error.message);
        continue;
      }
    }
    // metricas_mes: el unique es por índice con expresión (coalesce) que
    // supabase-js no puede referenciar → delete+insert por clave (idempotente).
    for (const m of r.mesesRows) {
      let del = sb.from("metricas_mes").delete().eq("mes", m.mes);
      del = m.flota == null ? del.is("flota", null) : del.eq("flota", m.flota);
      await del;
      const { error } = await sb.from("metricas_mes").insert({
        mes: m.mes,
        flota: m.flota,
        km: m.km ?? null,
        facturacion: m.facturacion ?? null,
        fact_km: m.factKm ?? null,
        costo_km_estudio: m.costoKm ?? null,
        prom_km: m.promKm ?? null,
        fuente: m.fuente,
      });
      if (error) console.error(`✗ ${r.mes} mes ${m.mes}/${m.flota ?? "-"}:`, error.message);
    }
    console.log(`✓ aplicado ${r.mes} (${r.filas.length} choferes, ${r.mesesRows.length} filas-mes)`);
  }

  // Linkeo chofer_id best-effort para lo nuevo (mismo criterio del SQL del 08/07).
  const { data: choferes } = await sb.from("choferes").select("id, nombre, apellido").eq("rol", "chofer");
  const { data: sinLink } = await sb.from("metricas_chofer_mes").select("id, chofer_nombre").is("chofer_id", null);
  let linked = 0;
  for (const row of sinLink ?? []) {
    const nombre = norm(row.chofer_nombre);
    const [t1, t2] = nombre.split(" ");
    const matches = (choferes ?? []).filter((c) => {
      const ap = norm(c.apellido ?? "");
      const no = norm(c.nombre ?? "");
      return ap === nombre || (ap === t1 && !!t2 && no.startsWith(t2));
    });
    if (matches.length === 1) {
      await sb.from("metricas_chofer_mes").update({ chofer_id: matches[0].id }).eq("id", row.id);
      linked++;
    }
  }
  console.log(`\nLinkeo chofer_id: ${linked} filas nuevas linkeadas, ${(sinLink?.length ?? 0) - linked} sin match.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
