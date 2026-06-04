/**
 * Carga el personal de administración y mantenimiento (12 personas) en la tabla
 * `choferes` con su `rol` (administrativo / mantenimiento). NO son choferes de
 * ruta: la lista de /choferes los filtra por rol (pestaña aparte). Sirven para
 * cumpleaños y aniversarios anuales (lógica ya existente).
 *
 * Fuente: "ANTIGUEDAD Y CUMPLESSS ADM Y MANT.xlsx" (antigüedad + nacimiento) +
 * "IMPORTES SUELDOS ABRIL.xlsx" (nombres completos). DNI pendiente (Bárbara).
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/seed-adm-mant.ts --dry-run
 *   npx tsx --env-file=.env scripts/seed-adm-mant.ts
 */
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Faltan envs"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
const key = (ap: string, no: string) => `${norm(ap)}|${norm(no).split(" ")[0]}`;

type Rol = "administrativo" | "mantenimiento";
type P = { apellido: string; nombre: string; rol: Rol; fecha_ingreso: string; fecha_nacimiento: string };

const PERSONAS: P[] = [
  // Administración
  { apellido: "Diaz", nombre: "Pablo Ricardo", rol: "administrativo", fecha_ingreso: "2010-11-03", fecha_nacimiento: "1973-05-08" },
  { apellido: "De Brito", nombre: "Virginia Guadalupe", rol: "administrativo", fecha_ingreso: "2016-11-01", fecha_nacimiento: "1976-01-17" },
  { apellido: "Hait", nombre: "Alejandro German", rol: "administrativo", fecha_ingreso: "2014-10-08", fecha_nacimiento: "1985-12-13" },
  { apellido: "Paterno", nombre: "Anabela", rol: "administrativo", fecha_ingreso: "2022-07-01", fecha_nacimiento: "1985-01-10" },
  { apellido: "Joaquin", nombre: "Jeremias", rol: "administrativo", fecha_ingreso: "2016-08-01", fecha_nacimiento: "1985-08-22" },
  { apellido: "Quiroga", nombre: "Nicolas Lihue", rol: "administrativo", fecha_ingreso: "2019-07-01", fecha_nacimiento: "1998-02-07" },
  // Mantenimiento
  { apellido: "Joaquin", nombre: "Alan Alexis", rol: "mantenimiento", fecha_ingreso: "2019-11-01", fecha_nacimiento: "1992-07-06" },
  { apellido: "Alveira", nombre: "Dario Ismael", rol: "mantenimiento", fecha_ingreso: "2017-07-03", fecha_nacimiento: "1970-02-28" },
  { apellido: "Heim", nombre: "Jonatan", rol: "mantenimiento", fecha_ingreso: "2025-02-01", fecha_nacimiento: "1995-04-17" },
  { apellido: "Joaquin", nombre: "Kevin Agustin", rol: "mantenimiento", fecha_ingreso: "2017-12-01", fecha_nacimiento: "1997-10-30" },
  { apellido: "Rossi", nombre: "Adrian Emilio", rol: "mantenimiento", fecha_ingreso: "2014-02-03", fecha_nacimiento: "1975-01-31" },
  { apellido: "Trejo", nombre: "Juan Carlos", rol: "mantenimiento", fecha_ingreso: "2009-12-14", fecha_nacimiento: "1959-05-29" },
];

async function main() {
  const { data, error } = await sb.from("choferes").select("apellido, nombre, rol");
  if (error) throw error;
  const existing = new Set((data ?? []).map((c) => key(c.apellido, c.nombre)));
  const toInsert = PERSONAS.filter((p) => !existing.has(key(p.apellido, p.nombre)));

  console.log(`Modo: ${DRY ? "DRY-RUN" : "WRITE"} | a insertar: ${toInsert.length}/${PERSONAS.length}`);
  toInsert.forEach((p) => console.log(`  + ${p.apellido}, ${p.nombre} [${p.rol}] ingreso ${p.fecha_ingreso} · nac ${p.fecha_nacimiento}`));
  const yaEstan = PERSONAS.filter((p) => existing.has(key(p.apellido, p.nombre)));
  if (yaEstan.length) console.log(`Ya existían (${yaEstan.length}): ${yaEstan.map((p) => p.apellido).join(", ")}`);

  if (DRY || toInsert.length === 0) return;
  let ok = 0, fail = 0;
  for (const p of toInsert) {
    const { error: e } = await sb.from("choferes").insert({
      apellido: p.apellido, nombre: p.nombre, rol: p.rol, estado: "activo",
      fecha_ingreso: p.fecha_ingreso, fecha_nacimiento: p.fecha_nacimiento,
    });
    if (e) { fail++; console.error(`  ✗ ${p.apellido}, ${p.nombre}: ${e.message}`); } else ok++;
  }
  console.log(`Resultado: ${ok} OK, ${fail} fallidos`);
}
main().catch((e) => { console.error(e); process.exit(1); });
