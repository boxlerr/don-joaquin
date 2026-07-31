/**
 * Corrige el desglose del sueldo (retenciones · adelantos · devol. préstamo ·
 * embargo judicial · aguinaldo) de los meses ya cargados.
 *
 *   npx tsx --env-file=.env scripts/corregir-desglose-sueldos.ts [--dir DIR] [--apply]
 *
 * Por qué existe, en vez de volver a correr cargar-metricas-drive.ts:
 * el importador masivo BORRA Y REESCRIBE el mes entero, y eso pisaría las
 * correcciones que se hicieron a mano en la auditoría del 09/07 (choferes que
 * la fuente escribe de dos formas distintas en la misma planilla —
 * CARDARELI/CARDARELLI, DE LIBANO/DEL LIBANO— y que quedaron unificados, más
 * filas fantasma que se borraron). Lo que carga una persona no lo pisa un
 * proceso automático.
 *
 * Este script NO inserta ni borra filas: solo ACTUALIZA las 5 columnas del
 * desglose sobre filas que ya existen, leyendo el PDF por coordenadas
 * (sueldo-fact.bbox.xml). Los valores salen tal cual de la planilla.
 *
 * Guardas:
 *  - la fila del PDF se aplica solo si su TOTAL coincide con el sueldo_total
 *    que ya está en la base (±1,5) → nunca se le pega el desglose de otro;
 *  - conceptos + neto tiene que dar el total de la página;
 *  - lo que no matchea se reporta y se saltea, no se inventa.
 */
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { desgloseDesdeXml } from "./parse-planillas-metricas";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const dirIdx = args.indexOf("--dir");
const BASE = dirIdx >= 0 ? args[dirIdx + 1] : join(process.cwd(), ".metricas-drive");

const CONCEPTOS = ["retenciones", "adelantos", "devolPrestamo", "embargoJudicial", "aguinaldo"] as const;
const COL: Record<(typeof CONCEPTOS)[number], string> = {
  retenciones: "retenciones",
  adelantos: "adelantos",
  devolPrestamo: "devol_prestamo",
  embargoJudicial: "embargo_judicial",
  aguinaldo: "aguinaldo",
};

const norm = (s: string) =>
  s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z ]/g, "").replace(/\s+/g, " ").trim();
const casi = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? false : Math.abs(a - b) <= 1.5;

type Fila = {
  id: string; chofer_nombre: string; flota: string; sueldo_total: number | null;
  retenciones: number | null; adelantos: number | null; devol_prestamo: number | null;
  embargo_judicial: number | null; aguinaldo: number | null;
};

/** Los dirs de mes que tienen el XML del sueldo, ordenados. */
function mesesConXml(): { mes: string; xml: string }[] {
  const out: { mes: string; xml: string }[] = [];
  for (const anio of readdirSync(BASE).filter((d) => /^\d{4}$/.test(d))) {
    for (const dir of readdirSync(join(BASE, anio))) {
      if (!/^\d{4}-\d{2}$/.test(dir)) continue;
      const xml = join(BASE, anio, dir, "sueldo-fact.bbox.xml");
      if (existsSync(xml)) out.push({ mes: `${dir}-01`, xml });
    }
  }
  return out.sort((a, b) => a.mes.localeCompare(b.mes));
}

async function main() {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !KEY) {
    console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (usar --env-file=.env).");
    process.exit(1);
  }
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });

  const meses = mesesConXml();
  console.log(`${meses.length} meses con XML del sueldo en ${BASE}\n`);

  let totalCambios = 0, totalFilas = 0;
  const sinMatch: string[] = [];
  const noCierran: string[] = [];

  for (const { mes, xml } of meses) {
    const { data, error } = await sb
      .from("metricas_chofer_mes")
      .select("id, chofer_nombre, flota, sueldo_total, retenciones, adelantos, devol_prestamo, embargo_judicial, aguinaldo")
      .eq("mes", mes);
    if (error) {
      console.error(`✗ ${mes}: ${error.message}`);
      continue;
    }
    const filas = (data ?? []) as unknown as Fila[];
    if (!filas.length) {
      console.log(`· ${mes}: sin filas en la base — se saltea (este script no inserta).`);
      continue;
    }
    const porNombre = new Map(filas.map((f) => [norm(f.chofer_nombre), f]));

    const cambios: { fila: Fila; nuevos: Record<string, number | null> }[] = [];
    for (const { nombre, celdas } of desgloseDesdeXml(readFileSync(xml, "utf8"))) {
      totalFilas++;
      const total = celdas.total;
      if (total == null) continue;
      // conceptos + neto = total de la página (control de la propia planilla)
      if (celdas.neto != null) {
        const suma = CONCEPTOS.reduce((s, c) => s + (celdas[c] ?? 0), 0) + celdas.neto;
        if (Math.abs(suma - total) > 1.5) {
          noCierran.push(`${mes} ${nombre}: conceptos+neto=${Math.round(suma)} ≠ total=${Math.round(total)}`);
          continue;
        }
      }
      // Match por nombre; si la fuente escribe el apellido distinto entre
      // planillas (CARDARELI/CARDARELLI) o dejó una fila fantasma con el
      // nombre de otro (RAMOS E), cae al sueldo_total, que es una clave única
      // de hecho: la página de retenciones repite el total del chofer.
      let fila = porNombre.get(norm(nombre));
      if (!fila || !casi(fila.sueldo_total, total)) {
        const porTotal = filas.filter((f) => casi(f.sueldo_total, total));
        if (porTotal.length === 1) fila = porTotal[0];
      }
      if (!fila) {
        sinMatch.push(`${mes} ${nombre} (total ${Math.round(total)}): no hay una fila sola que le corresponda`);
        continue;
      }
      // Nunca escribirle el desglose de otro: el total tiene que ser el suyo.
      if (!casi(fila.sueldo_total, total)) {
        sinMatch.push(
          `${mes} ${nombre}: el total de la página (${Math.round(total)}) no es el de la base (${fila.sueldo_total == null ? "sin sueldo" : Math.round(fila.sueldo_total)})`,
        );
        continue;
      }
      const nuevos: Record<string, number | null> = {};
      let difiere = false;
      for (const c of CONCEPTOS) {
        const v = celdas[c] ?? null;
        nuevos[COL[c]] = v;
        const actual = fila[COL[c] as keyof Fila] as number | null;
        if (v == null ? actual != null : !casi(actual, v)) difiere = true;
      }
      if (difiere) cambios.push({ fila, nuevos });
    }

    if (!cambios.length) {
      console.log(`✓ ${mes}: ${filas.length} filas · ya está bien`);
      continue;
    }
    totalCambios += cambios.length;
    console.log(`△ ${mes}: ${cambios.length} de ${filas.length} filas a corregir`);
    for (const { fila, nuevos } of cambios.slice(0, 4)) {
      const antes = CONCEPTOS.map((c) => `${c}=${fila[COL[c] as keyof Fila] ?? "—"}`).join(" ");
      const desp = CONCEPTOS.map((c) => `${c}=${nuevos[COL[c]] ?? "—"}`).join(" ");
      console.log(`    ${fila.chofer_nombre}\n      antes:  ${antes}\n      queda:  ${desp}`);
    }
    if (cambios.length > 4) console.log(`    … y ${cambios.length - 4} más`);

    if (APPLY) {
      for (const { fila, nuevos } of cambios) {
        const { error: e } = await sb.from("metricas_chofer_mes").update(nuevos).eq("id", fila.id);
        if (e) console.error(`  ✗ ${fila.chofer_nombre}: ${e.message}`);
      }
      console.log(`    ✓ aplicado`);
    }
  }

  console.log(`\n${totalFilas} filas de desglose leídas de los PDFs · ${totalCambios} filas a corregir en la base`);
  if (noCierran.length) {
    console.log(`\n⚠️ Filas de la PLANILLA que no cierran (conceptos+neto ≠ total) — ${noCierran.length}:`);
    noCierran.forEach((x) => console.log("  -", x));
  }
  if (sinMatch.length) {
    console.log(`\n⚠️ Filas del PDF sin fila propia en la base (se saltearon) — ${sinMatch.length}:`);
    sinMatch.forEach((x) => console.log("  -", x));
  }
  if (!APPLY) console.log("\nDry-run (sin --apply): no se escribió nada.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
