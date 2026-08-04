// Importador one-time de "rep y rep" -> costos_rep_rep.
// Uso: node scripts/import-costos-rep-rep.cjs  (dry-run: valida totales por mes y escribe /tmp/insert-costos.sql)
// El SQL generado es idempotente (on conflict mes+proveedor). Cargado a DB via MCP el 24/06.
const XLSX = require("/Users/julianboxler/Documents/GitHub/don-joaquin/node_modules/xlsx");
const fs = require("fs");
const path = "/Users/julianboxler/Desktop/Trabajos Vaxler/Don Joaquin SRL/Documentos Don Joaquin/rep y rep (1).xlsx";
const wb = XLSX.readFile(path);
const rows = XLSX.utils.sheet_to_json(wb.Sheets["Hoja1"], { header: 1, defval: null, raw: false });

const MESES = { "enero": "01", "febrero": "02", "marzo": "03", "abril": "04", "mayo": "05", "junio": "06", "julio": "07", "agosto": "08", "septiembre": "09", "octubre": "10", "noviembre": "11", "diciembre": "12" };
function mesToDate(s) {
  // "enero '26" -> 2026-01-01
  const m = String(s).toLowerCase().match(/([a-zé]+)\s*'?(\d{2,4})/);
  if (!m) return null;
  const mm = MESES[m[1]]; if (!mm) return null;
  let yy = m[2]; if (yy.length === 2) yy = "20" + yy;
  return `${yy}-${mm}-01`;
}
// El Excel escribe los COSTOS entre paréntesis (es un export contable: el costo
// es un movimiento negativo de la cuenta). Una línea SIN paréntesis es entonces
// una nota de crédito, y tiene que quedar negativa. Tomar Math.abs() de todo
// sumaba el crédito de R. G. COMERCIAL de enero '26 como si fuera un costo y
// dejaba el mes $744.050 arriba del total del Excel (2 × 372.025,11).
function amt(s) {
  if (s == null || s === "") return 0;
  let t = String(s).trim();
  const entreParentesis = /^\(.*\)$/.test(t);
  t = t.replace(/[()]/g, "").replace(/\s/g, "").replace(/,/g, "");
  let n = parseFloat(t); if (isNaN(n)) n = 0;
  return entreParentesis ? Math.abs(n) : -Math.abs(n);
}

// La cuenta contable viene como "Prov/NOMBRE"; el prefijo no es parte del nombre
// del proveedor y en el sistema se guarda limpio (si no, el mismo proveedor
// cargado a mano queda como uno distinto).
function nombreProveedor(s) {
  return String(s).replace(/^\s*Prov\s*\//i, "").replace(/\s+/g, " ").trim();
}

const data = [];
const totalsExcel = {}; // mes -> facturado_total de la fila "Total"
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const mesRaw = r[0], prov = r[1];
  if (!mesRaw || mesRaw === "Mes/Año") continue;
  const mes = mesToDate(mesRaw);
  if (!mes) continue;
  if (prov && /^total$/i.test(String(prov).trim())) { totalsExcel[mes] = amt(r[7]); continue; }
  if (!prov) continue;
  data.push({
    mes, proveedor: nombreProveedor(prov),
    neto_gravado: amt(r[2]), facturado_gravado: amt(r[3]),
    neto_ng: amt(r[4]), facturado_ng: amt(r[5]),
    neto_total: amt(r[6]), facturado_total: amt(r[7]),
  });
}

// Validación: sum(facturado_total) por mes vs fila Total del Excel
const sumByMes = {};
for (const d of data) sumByMes[d.mes] = (sumByMes[d.mes]||0) + d.facturado_total;
console.log("=== VALIDACIÓN (facturado_total por mes) ===");
let okAll = true;
for (const mes of Object.keys(totalsExcel)) {
  const calc = Math.round((sumByMes[mes]||0)*100)/100;
  const excel = Math.round(totalsExcel[mes]*100)/100;
  const ok = Math.abs(calc - excel) < 1;
  if (!ok) okAll = false;
  console.log(`  ${mes}: filas=${data.filter(d=>d.mes===mes).length}  sumado=${calc.toLocaleString()}  excelTotal=${excel.toLocaleString()}  ${ok?"OK":"❌ DIFIERE"}`);
}
console.log(`Total filas a cargar: ${data.length}  | Validación global: ${okAll?"OK ✅":"REVISAR ❌"}`);

// Generar SQL idempotente
const esc = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const values = data.map(d =>
  `(${esc(d.mes)}, ${esc(d.proveedor)}, ${d.neto_gravado}, ${d.facturado_gravado}, ${d.neto_ng}, ${d.facturado_ng}, ${d.neto_total}, ${d.facturado_total})`
).join(",\n");
const sql = `insert into public.costos_rep_rep
  (mes, proveedor, neto_gravado, facturado_gravado, neto_ng, facturado_ng, neto_total, facturado_total)
values
${values}
on conflict (mes, proveedor) do update set
  neto_gravado = excluded.neto_gravado,
  facturado_gravado = excluded.facturado_gravado,
  neto_ng = excluded.neto_ng,
  facturado_ng = excluded.facturado_ng,
  neto_total = excluded.neto_total,
  facturado_total = excluded.facturado_total;`;
fs.writeFileSync("/tmp/insert-costos.sql", sql);
console.log("\nSQL escrito en /tmp/insert-costos.sql  (", sql.length, "chars )");
console.log("Muestra 3 filas:", JSON.stringify(data.slice(0,3), null, 0));
