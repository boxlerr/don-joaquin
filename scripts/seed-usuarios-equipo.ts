/**
 * Crea los usuarios del equipo según la matriz de permisos de Bárbara (03/06).
 * SIN email real todavía: se usan placeholders y estado "inactivo" (no pueden
 * loguear hasta que un admin cargue el email real + active). Idempotente: si ya
 * existe un usuario con ese email, lo saltea.
 *
 * Matriz:
 *   Nicolás Joaquín, Bárbara Joaquín  → admin (ven todo)
 *   Nico Quiroga   → operativo + viajes, comercial, finanzas
 *   Virginia De Brito → operativo + viajes
 *   Jonatan Heim   → operativo + mantenimiento, combustible
 *   Pablo Díaz     → operativo + combustible
 *   (Caja = papá + Bárbara → cubierto por los admin; Joaquín padre usa cuenta admin)
 *
 * Base "operativo" = logística + flota + compliance (las áreas "todos").
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/seed-usuarios-equipo.ts --dry-run
 *   npx tsx --env-file=.env scripts/seed-usuarios-equipo.ts
 */
import { createClient } from "@supabase/supabase-js";

const DRY = process.argv.includes("--dry-run");
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Faltan envs"); process.exit(1); }
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

const TEMP_PASS = "CambiameYa.2026"; // placeholder; el usuario está inactivo igual

type U = { nombre: string; apellido: string; email: string; rol: "admin" | "operativo"; overrides: string[] };
const EQUIPO: U[] = [
  { nombre: "Nicolás", apellido: "Joaquín", email: "nicolas.joaquin@pendiente.donjoaquin.com", rol: "admin", overrides: [] },
  { nombre: "Bárbara", apellido: "Joaquín", email: "barbara.joaquin@pendiente.donjoaquin.com", rol: "admin", overrides: [] },
  { nombre: "Nicolás", apellido: "Quiroga", email: "nico.quiroga@pendiente.donjoaquin.com", rol: "operativo", overrides: ["viajes", "comercial", "finanzas"] },
  { nombre: "Virginia", apellido: "De Brito", email: "virginia.debrito@pendiente.donjoaquin.com", rol: "operativo", overrides: ["viajes"] },
  { nombre: "Jonatan", apellido: "Heim", email: "jonatan.heim@pendiente.donjoaquin.com", rol: "operativo", overrides: ["mantenimiento", "combustible"] },
  { nombre: "Pablo", apellido: "Díaz", email: "pablo.diaz@pendiente.donjoaquin.com", rol: "operativo", overrides: ["combustible"] },
];

async function main() {
  const { data: roles } = await sb.from("roles").select("id, codigo");
  const rolId = new Map((roles ?? []).map((r) => [r.codigo, r.id]));
  const { data: existentes } = await sb.from("usuarios").select("email");
  const yaExisten = new Set((existentes ?? []).map((u) => (u.email ?? "").toLowerCase()));

  const aCrear = EQUIPO.filter((u) => !yaExisten.has(u.email.toLowerCase()));
  console.log(`Modo: ${DRY ? "DRY-RUN" : "WRITE"} | a crear: ${aCrear.length}/${EQUIPO.length}`);
  aCrear.forEach((u) => console.log(`  + ${u.nombre} ${u.apellido} [${u.rol}] overrides: ${u.overrides.join(", ") || "—"}  (${u.email})`));
  const skip = EQUIPO.filter((u) => yaExisten.has(u.email.toLowerCase()));
  if (skip.length) console.log(`Ya existían: ${skip.map((u) => u.email).join(", ")}`);
  if (DRY || aCrear.length === 0) return;

  let ok = 0, fail = 0;
  for (const u of aCrear) {
    const rid = rolId.get(u.rol);
    if (!rid) { fail++; console.error(`  ✗ ${u.email}: rol "${u.rol}" inexistente`); continue; }
    const { data: auth, error: authErr } = await sb.auth.admin.createUser({
      email: u.email, password: TEMP_PASS, email_confirm: true,
    });
    if (authErr || !auth.user) { fail++; console.error(`  ✗ ${u.email}: ${authErr?.message}`); continue; }
    const { error: dbErr } = await sb.from("usuarios").insert({
      id: auth.user.id, email: u.email, nombre: u.nombre, apellido: u.apellido,
      rol_id: rid, estado: "inactivo", must_change_password: true,
    });
    if (dbErr) { fail++; await sb.auth.admin.deleteUser(auth.user.id); console.error(`  ✗ ${u.email}: ${dbErr.message}`); continue; }
    for (const area of u.overrides) {
      const { error: ovErr } = await sb.from("usuario_areas").insert({
        usuario_id: auth.user.id, area_codigo: area, nivel: "write", motivo: "Matriz de permisos Bárbara (03/06)",
      });
      if (ovErr) console.error(`    ⚠ override ${area} de ${u.email}: ${ovErr.message}`);
    }
    ok++; console.log(`  ✓ ${u.nombre} ${u.apellido} creado (inactivo) + ${u.overrides.length} overrides`);
  }
  console.log(`\nResultado: ${ok} OK, ${fail} fallidos`);
}
main().catch((e) => { console.error(e); process.exit(1); });
