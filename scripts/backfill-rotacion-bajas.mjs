// Carga en `rotacion_bajas` los egresos del legajo que quedaron afuera.
//
//   node scripts/backfill-rotacion-bajas.mjs            → dry-run, fila por fila
//   node scripts/backfill-rotacion-bajas.mjs --aplicar  → escribe
//
// Por qué hace falta: `rotacion_bajas` se cargó una sola vez desde el Excel y el
// egreso del legajo no escribía nada ahí. Desde el 01/09/2026 sí lo hace
// (`lib/rotacion-baja.ts`), pero los que ya estaban egresados nunca se cargaron:
// rotación mostraba 5 bajas en 2026 con 12 egresados no fleteros en el legajo.
// Bárbara, 31/08: *"me puse a mirar el índice de rotación y me parecía que
// estaba muy bajo"*.
//
// Es idempotente: sólo escribe lo que falta, y salta a quien ya tenga fila —por
// `chofer_id` o por apellido, que es como entraron las del Excel—. Correrlo dos
// veces no duplica a nadie.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const aplicar = process.argv.includes("--aplicar");
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const sb = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim(),
  { auth: { persistSession: false } },
);

// ── Las mismas reglas que usa el sistema al egresar (domain/rotacion). Están
//    repetidas acá y no importadas porque el módulo es TS y esto corre en node
//    pelado; si alguna cambia allá, hay que tocarla acá.
const TIPO_BAJA = {
  renuncia: "renuncia_voluntaria",
  despido: "despido",
  jubilacion: "jubilacion",
  otro: "otro",
};
const tipoBajaDesdeMotivo = (m) => (m ? TIPO_BAJA[m] ?? "otro" : "otro");
const cuentaParaRotacion = (rol) => rol !== "fletero";

function mesesEntreFechas(desde, hasta) {
  if (!desde || !hasta) return null;
  const [ay, am, ad] = desde.slice(0, 10).split("-").map(Number);
  const [by, bm, bd] = hasta.slice(0, 10).split("-").map(Number);
  if (!ay || !am || !ad || !by || !bm || !bd) return null;
  let meses = (by - ay) * 12 + (bm - am);
  if (bd < ad) meses -= 1;
  return meses < 0 ? null : meses;
}

function antiguedadTexto(meses) {
  if (meses === null || meses === undefined) return "—";
  if (meses < 1) return "< 1 mes";
  if (meses < 12) return `${meses} ${meses === 1 ? "mes" : "meses"}`;
  const anios = Math.floor(meses / 12);
  const resto = meses % 12;
  return resto === 0
    ? `${anios} ${anios === 1 ? "año" : "años"}`
    : `${anios} ${anios === 1 ? "año" : "años"} ${resto} ${resto === 1 ? "mes" : "meses"}`;
}

const norm = (s) =>
  (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z]/g, "");

// ── Datos ────────────────────────────────────────────────────────────────────
const [{ data: egresados }, { data: bajas }, { data: admin }] = await Promise.all([
  sb
    .from("choferes")
    .select("id, nombre, apellido, rol, localidad, fecha_ingreso, fecha_egreso, motivo_egreso")
    .eq("estado", "baja")
    .order("fecha_egreso"),
  sb.from("rotacion_bajas").select("id, chofer_id, nombre, anio, fecha_egreso"),
  sb.from("usuarios").select("id").eq("email", "boxlerjulian@hotmail.com").maybeSingle(),
]);

const yaPorId = new Set(bajas.filter((b) => b.chofer_id).map((b) => b.chofer_id));

/**
 * ¿Ya está cargado del Excel? Ahí el nombre viene suelto y abreviado —"PITTANA
 * JORGE", "GOMEZ RICARDO", "CARDARELLI"— sin id, así que hay que cruzarlo a mano.
 *
 * El apellido solo NO alcanza: hay dos Lagano y dos Pittana distintos, y darlos
 * por cargados sería perder una baja real. Pero pedir que coincida el primer
 * nombre tampoco sirve: en el Excel "GOMEZ RICARDO" es Matías **Ricardo** Alberto
 * Gomez, y su segundo nombre es el que figura. Así que se compara contra TODOS
 * sus nombres de pila, y si la fila del Excel es sólo el apellido (CARDARELLI),
 * se acepta: no hay con quién confundirlo.
 */
function yaPorNombre(chofer) {
  const ap = norm(chofer.apellido);
  if (ap.length < 3) return null;
  const pilas = (chofer.nombre ?? "").split(/\s+/).map(norm).filter((x) => x.length >= 3);
  return (
    bajas.find((b) => {
      const n = norm(b.nombre);
      if (!n.includes(ap)) return false;
      if (pilas.some((x) => n.includes(x))) return true;
      // La fila del Excel es sólo el apellido: no distingue personas.
      return n === ap;
    }) ?? null
  );
}

const aCargar = [];
const salteados = [];

for (const c of egresados ?? []) {
  const quien = `${c.apellido ?? ""}, ${c.nombre ?? ""}`.trim();
  if (!cuentaParaRotacion(c.rol)) {
    salteados.push([quien, "es fletero — no entra en el índice"]);
    continue;
  }
  if (yaPorId.has(c.id)) {
    salteados.push([quien, "ya tiene su baja cargada"]);
    continue;
  }
  const delExcel = yaPorNombre(c);
  if (delExcel) {
    salteados.push([quien, `ya estaba del Excel como "${delExcel.nombre}" (${delExcel.anio})`]);
    continue;
  }
  if (!c.fecha_egreso) {
    salteados.push([quien, "sin fecha de egreso en el legajo — no se le puede poner año"]);
    continue;
  }
  const meses = mesesEntreFechas(c.fecha_ingreso, c.fecha_egreso);
  aCargar.push({
    chofer_id: c.id,
    nombre: [c.apellido, c.nombre].filter(Boolean).join(" ").trim() || "(sin nombre)",
    fecha_ingreso: c.fecha_ingreso,
    fecha_egreso: c.fecha_egreso,
    anio: Number(c.fecha_egreso.slice(0, 4)),
    antiguedad_meses: meses,
    antiguedad_texto: meses == null ? null : antiguedadTexto(meses),
    tipo_baja: tipoBajaDesdeMotivo(c.motivo_egreso),
    motivo: null,
    base_zona: c.localidad,
    observaciones: "Se cargó al cruzar los egresos del legajo con rotación (01/09/2026).",
    created_by: admin?.id ?? null,
    updated_by: admin?.id ?? null,
  });
}

// ── Informe ──────────────────────────────────────────────────────────────────
console.log(`Egresados en el legajo: ${egresados.length}   ·   Bajas ya cargadas: ${bajas.length}\n`);

console.log("── No se tocan ──");
for (const [quien, por] of salteados) console.log(`   ${quien.padEnd(34)} ${por}`);

console.log(`\n── ${aplicar ? "Se cargan" : "Se cargarían"} ${aCargar.length} ──`);
for (const f of aCargar) {
  console.log(
    `   ${f.nombre.padEnd(34)} ${f.fecha_egreso}  ${String(f.anio)}  ${f.tipo_baja.padEnd(20)} antigüedad: ${f.antiguedad_texto ?? "—"}`,
  );
}

const porAnio = {};
for (const b of bajas) porAnio[b.anio] = (porAnio[b.anio] ?? 0) + 1;
const suma = {};
for (const f of aCargar) suma[f.anio] = (suma[f.anio] ?? 0) + 1;
console.log("\n── Bajas por año ──");
for (const a of [...new Set([...Object.keys(porAnio), ...Object.keys(suma)])].sort()) {
  const antes = porAnio[a] ?? 0;
  const suman = suma[a] ?? 0;
  console.log(`   ${a}: ${antes}${suman ? ` + ${suman} = ${antes + suman}` : ""}`);
}

if (!aplicar) {
  console.log("\nNada escrito. Volvé a correrlo con --aplicar.");
  process.exit(0);
}
if (aCargar.length === 0) {
  console.log("\nNo hay nada que cargar.");
  process.exit(0);
}

const { error } = await sb.from("rotacion_bajas").insert(aCargar);
if (error) {
  console.error("\nNo se pudo cargar:", error.message);
  process.exit(1);
}
console.log(`\n→ ${aCargar.length} baja(s) cargadas.`);

const { count } = await sb.from("rotacion_bajas").select("*", { count: "exact", head: true });
console.log(`   rotacion_bajas quedó con ${count} filas.`);
