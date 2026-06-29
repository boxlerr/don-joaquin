/**
 * Activa un usuario del equipo creado con email placeholder por
 * `seed-usuarios-equipo.ts`: le carga el email real, lo pasa a estado "activo"
 * y deja una contraseña provisoria con `must_change_password = true` (al primer
 * login el sistema lo obliga a definir la suya en /auth/cambiar-password).
 *
 * Usa el admin API (updateUserById) para que el cambio de email quede consistente
 * tanto en auth.users como en auth.identities. Idempotente y con --dry-run.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/activar-usuario.ts \
 *     --buscar=nico.quiroga@pendiente.donjoaquin.com \
 *     --email=nicolasquirogac@hotmail.com [--pass=CambiameYa.2026] [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";

const arg = (k: string) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=").slice(1).join("=");
const DRY = process.argv.includes("--dry-run");

const BUSCAR = (arg("buscar") ?? "").trim().toLowerCase();
const EMAIL = (arg("email") ?? "").trim().toLowerCase();
const PASS = arg("pass") ?? "CambiameYa.2026";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Faltan envs de Supabase"); process.exit(1); }
if (!BUSCAR || !EMAIL) { console.error("Faltan --buscar y/o --email"); process.exit(1); }
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(EMAIL)) { console.error("Email inválido"); process.exit(1); }
if (PASS.length < 6) { console.error("La contraseña provisoria debe tener al menos 6 caracteres"); process.exit(1); }

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

async function main() {
  const { data: u, error } = await sb
    .from("usuarios")
    .select("id, email, nombre, apellido, estado, must_change_password")
    .ilike("email", BUSCAR)
    .maybeSingle();
  if (error) { console.error(error.message); process.exit(1); }
  if (!u) { console.error(`No encontré un usuario con email ${BUSCAR}`); process.exit(1); }

  // El email nuevo no debe estar tomado por OTRO usuario
  const { data: choque } = await sb
    .from("usuarios")
    .select("id")
    .ilike("email", EMAIL)
    .neq("id", u.id)
    .maybeSingle();
  if (choque) { console.error(`El email ${EMAIL} ya está usado por otro usuario`); process.exit(1); }

  console.log(`Modo: ${DRY ? "DRY-RUN" : "WRITE"}`);
  console.log(`  Usuario: ${u.nombre} ${u.apellido ?? ""} (${u.id})`);
  console.log(`  email:   ${u.email}  ->  ${EMAIL}`);
  console.log(`  estado:  ${u.estado}  ->  activo`);
  console.log(`  pass:    (provisoria) ${PASS}   must_change_password: true`);
  if (DRY) return;

  // 1) auth: email + password (email_confirm:true => sin mail de verificación)
  const { error: authErr } = await sb.auth.admin.updateUserById(u.id, {
    email: EMAIL,
    password: PASS,
    email_confirm: true,
  });
  if (authErr) { console.error(`✗ auth: ${authErr.message}`); process.exit(1); }

  // 2) perfil: email real + activo + forzar cambio de contraseña
  const { error: dbErr } = await sb
    .from("usuarios")
    .update({
      email: EMAIL,
      estado: "activo",
      must_change_password: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", u.id);
  if (dbErr) { console.error(`✗ perfil: ${dbErr.message}`); process.exit(1); }

  console.log(`\n✓ ${u.nombre} ${u.apellido ?? ""} activado. Login: ${EMAIL} / ${PASS}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
