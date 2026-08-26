// Corre un archivo .sql contra la base, con la conexión de DATABASE_URL.
//
//   node scripts/aplicar-migracion.mjs supabase/migrations/xxx.sql
//   node scripts/aplicar-migracion.mjs --sql "select 1"
//
// Existe porque las migraciones de este proyecto se aplican a mano y la API de
// Supabase (service role) no ejecuta DDL: mueve filas dentro de las tablas que
// ya existen, pero no crea una columna ni reemplaza una vista.
import pg from "pg";
import { readFileSync } from "node:fs";

const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const url = env.match(/DATABASE_URL=(.*)/)?.[1]?.trim();
if (!url) throw new Error("Falta DATABASE_URL en .env");

const argSql = process.argv.indexOf("--sql");
const sql = argSql >= 0 ? process.argv[argSql + 1] : readFileSync(process.argv[2], "utf8");
const nombre = argSql >= 0 ? "(sql suelto)" : process.argv[2];

const cliente = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await cliente.connect();
try {
  const res = await cliente.query(sql);
  const resultados = Array.isArray(res) ? res : [res];
  console.log(`✓ ${nombre}`);
  for (const r of resultados) {
    if (r.command && r.rowCount !== null && !r.rows?.length) console.log(`   ${r.command} → ${r.rowCount} fila(s)`);
    if (r.rows?.length) console.table(r.rows);
  }
} catch (e) {
  console.error(`✗ ${nombre}\n   ${e.message}`);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
