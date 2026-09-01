// Activa el acceso de Nicolás Joaquín: le pone su email real, una contraseña
// inicial y lo deja activo. El rol Administrador no se toca —ya lo tiene— y
// tampoco se crea desde la UI a propósito (`crearUsuarioAction` lo rechaza).
//
//   node scripts/activar-usuario-nicolas.mjs --clave <clave>
//       → dry-run, no escribe nada
//   node scripts/activar-usuario-nicolas.mjs --clave <clave> --aplicar
//       → aplica los cambios
//
// Es idempotente: correrlo dos veces deja lo mismo. La contraseña se reescribe
// en cada corrida con --aplicar, así que sirve también para resetearla.
//
// La clave va por argumento y no escrita acá a propósito: este archivo se commitea.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const EMAIL_VIEJO = "nicolas.joaquin@pendiente.donjoaquin.com";
const EMAIL_NUEVO = "joaquinhnos@yahoo.com.ar";
const aplicar = process.argv.includes("--aplicar");
const PASSWORD = process.argv[process.argv.indexOf("--clave") + 1];
if (!PASSWORD || PASSWORD.startsWith("--")) {
  console.error("Falta la contraseña inicial: --clave <clave>");
  process.exit(1);
}
if (PASSWORD.length < 8) {
  console.error("La contraseña tiene que tener al menos 8 caracteres (lo exige el sistema).");
  process.exit(1);
}
const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
const sb = createClient(
  env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim(),
  env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim(),
  { auth: { persistSession: false } },
);

const log = (...a) => console.log(...a);
const paso = (txt) => log(`${aplicar ? "→" : "· (dry-run)"} ${txt}`);

// ── 1. Encontrar la fila. Se busca por los dos emails para que una segunda
//       corrida (cuando el email ya es el nuevo) lo siga encontrando.
const { data: filas, error: errBusca } = await sb
  .from("usuarios")
  .select("id, email, nombre, apellido, estado, rol_id, must_change_password")
  .in("email", [EMAIL_VIEJO, EMAIL_NUEVO]);
if (errBusca) throw errBusca;

if (!filas?.length) {
  console.error(`No hay ningún usuario con ${EMAIL_VIEJO} ni ${EMAIL_NUEVO}. No se toca nada.`);
  process.exit(1);
}
if (filas.length > 1) {
  console.error("Hay más de un usuario con esos emails. Revisalo a mano:", filas);
  process.exit(1);
}
const usuario = filas[0];

// ── 2. Que el email nuevo no sea de otra persona.
const { data: choque } = await sb
  .from("usuarios")
  .select("id, email, nombre")
  .eq("email", EMAIL_NUEVO)
  .neq("id", usuario.id);
if (choque?.length) {
  console.error(`${EMAIL_NUEVO} ya es de otro usuario:`, choque);
  process.exit(1);
}

const { data: rol } = await sb
  .from("roles")
  .select("codigo, nombre")
  .eq("id", usuario.rol_id)
  .maybeSingle();

log("── Estado actual ──");
log(`  ${usuario.nombre} ${usuario.apellido ?? ""}`.trimEnd());
log(`  email:  ${usuario.email}`);
log(`  estado: ${usuario.estado}`);
log(`  rol:    ${rol?.nombre ?? usuario.rol_id}`);
log("");
log("── Queda ──");
log(`  email:  ${EMAIL_NUEVO}`);
log(`  estado: activo`);
log(`  rol:    ${rol?.nombre ?? usuario.rol_id} (sin cambios)`);
log(`  contraseña: la que pasaste por --clave (pide cambiarla en el primer ingreso)`);
log("");

if (!aplicar) {
  log("Nada escrito. Volvé a correrlo con --aplicar para hacerlo.");
  process.exit(0);
}

// ── 3. Auth: email + contraseña. Va primero porque es lo que puede fallar
//       (email duplicado en auth), y así no queda la fila de `usuarios` con un
//       email que el login no reconoce.
const { error: errAuth } = await sb.auth.admin.updateUserById(usuario.id, {
  email: EMAIL_NUEVO,
  password: PASSWORD,
  email_confirm: true,
});
if (errAuth) {
  console.error("No se pudo actualizar el acceso:", errAuth.message);
  process.exit(1);
}
paso("acceso actualizado (email + contraseña)");

// ── 4. Perfil.
const { error: errPerfil } = await sb
  .from("usuarios")
  .update({
    email: EMAIL_NUEVO,
    estado: "activo",
    // Que la cambie él: la contraseña inicial pasa por WhatsApp.
    must_change_password: true,
    updated_at: new Date().toISOString(),
  })
  .eq("id", usuario.id);
if (errPerfil) {
  console.error("El acceso quedó actualizado pero el perfil no:", errPerfil.message);
  process.exit(1);
}
paso("perfil actualizado (email + activo)");

// ── 5. Auditoría: por script no pasa por `editarUsuarioAction`, así que el
//       registro lo dejamos a mano. Sin esto el cambio de email de un admin no
//       figura en ningún lado.
const { data: admin } = await sb
  .from("usuarios")
  .select("id")
  .eq("email", "boxlerjulian@hotmail.com")
  .maybeSingle();

await sb.from("audit_log").insert({
  usuario_id: admin?.id ?? null,
  accion: "actualizar",
  entidad_tipo: "usuarios",
  entidad_id: usuario.id,
  valores_anteriores: { email: usuario.email, estado: usuario.estado },
  valores_nuevos: { email: EMAIL_NUEVO, estado: "activo" },
  metadata: { origen: "scripts/activar-usuario-nicolas.mjs" },
});
paso("registrado en auditoría");

log("\nListo.");
