/**
 * Prende los avisos de impuestos para el equipo, separando los DOS calendarios.
 *
 *   npx tsx --env-file=.env scripts/activar-alertas-impuestos.ts          → dry-run
 *   npx tsx --env-file=.env scripts/activar-alertas-impuestos.ts --aplicar
 *
 * Pedido de Nicolás (02/09/2026): los vencimientos de Joaquín Hnos los espera
 * todo el equipo administrativo; los suyos —Joaquín Nicolás, CUIT
 * 20-26402739-0— sólo él, Nico Quiroga y Paula.
 *
 * Eso son DOS cosas distintas y las dos hacen falta:
 *
 *   · el PERMISO — «Impuestos personales» es una sección confidencial, así que
 *     está cerrada hasta que se otorgue de a un usuario (`usuario_secciones`).
 *     Los administradores la tienen siempre, por su rol;
 *   · la PREFERENCIA — el casillero de /configuracion/notificaciones, que es lo
 *     que decide si el correo sale. Un permiso sin casillero tildado no manda
 *     nada, y un casillero tildado sin permiso lo filtra el envío.
 *
 * OJO con el orden: local y producción comparten la MISMA base. Hasta que el
 * código esté desplegado, producción no sabe leer `impuesto_entidades` y rutea
 * TODO a la columna «Impuestos». Correr esto antes del deploy es mandarle el
 * calendario personal de Nicolás a todo el equipo. Primero el deploy, después
 * esto.
 *
 * Idempotente: se puede correr las veces que haga falta.
 */
import { createClient } from "@supabase/supabase-js";
import { getUsuariosConSeccionCon } from "../src/lib/permisos-usuarios-query";
import { COLUMNAS_TODAS } from "../src/lib/alertas-routing";

const APLICAR = process.argv.includes("--aplicar");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
const sb = createClient(url, key);

const MATRIZ_CLAVE = "notificaciones_matriz_por_usuario";

/**
 * Quiénes reciben el calendario PERSONAL. Por email y no por id: los ids no se
 * leen, y si mañana alguien se da de alta de nuevo el email sigue siendo el
 * mismo dato que dijo Nicolás.
 */
const PERSONALES = [
  "joaquinhnos@yahoo.com.ar", // Nicolás Joaquín — es su calendario
  "nicolasquirogac@hotmail.com", // Nico Quiroga
  "paulit118@icloud.com", // Paula Quiroga
];

/**
 * Quiénes reciben el de la EMPRESA. "A todos" es el equipo que ya recibe avisos
 * administrativos: se le suma la columna a quien YA está en la matriz, en vez de
 * empezar a mandarle correos a alguien que hasta hoy no recibía ninguno.
 */
const EMPRESA_A_TODOS_LOS_QUE_YA_RECIBEN = true;

type Usuario = { id: string; email: string; nombre: string | null; apellido: string | null };

function nombreDe(u: Usuario) {
  return `${u.nombre ?? ""} ${u.apellido ?? ""}`.trim() || u.email;
}

async function main() {
  console.log(APLICAR ? "APLICANDO cambios\n" : "DRY-RUN (nada se escribe). Agregá --aplicar.\n");

  const { data: usuariosData } = await sb
    .from("usuarios")
    .select("id, email, nombre, apellido")
    .eq("estado", "activo");
  const usuarios = (usuariosData ?? []) as Usuario[];
  const porEmail = new Map(usuarios.map((u) => [u.email.toLowerCase(), u]));

  // ── 1) Permiso: la sección confidencial, de a un usuario ─────────────────
  const faltantes: Usuario[] = [];
  for (const email of PERSONALES) {
    const u = porEmail.get(email.toLowerCase());
    if (!u) {
      console.log(`  ! No hay usuario activo con el email ${email} — se saltea`);
      continue;
    }
    faltantes.push(u);
  }

  const { data: yaOtorgadas } = await sb
    .from("usuario_secciones")
    .select("usuario_id, nivel")
    .eq("seccion_codigo", "impuestos_personales");
  const yaTiene = new Set(((yaOtorgadas ?? []) as { usuario_id: string }[]).map((r) => r.usuario_id));

  console.log("Sección «Impuestos personales» (permiso):");
  for (const u of faltantes) {
    if (yaTiene.has(u.id)) {
      console.log(`  = ${nombreDe(u)} — ya la tenía`);
      continue;
    }
    console.log(`  + ${nombreDe(u)}`);
    if (APLICAR) {
      const { error } = await sb.from("usuario_secciones").insert({
        usuario_id: u.id,
        seccion_codigo: "impuestos_personales",
        nivel: "write",
        motivo: "Calendario de Joaquín Nicolás (pedido de Nicolás, 02/09/2026)",
      });
      if (error) console.log(`    ✗ ${error.message}`);
    }
  }

  // ── 2) Preferencia: los casilleros de la matriz ──────────────────────────
  const { data: paramRow } = await sb
    .from("parametros_sistema")
    .select("valor")
    .eq("clave", MATRIZ_CLAVE)
    .maybeSingle();
  const matriz: Record<string, string[]> = JSON.parse((paramRow?.valor as string) || "{}");

  const idsPersonales = new Set(faltantes.map((u) => u.id));
  const cambios: string[] = [];

  for (const [usuarioId, columnas] of Object.entries(matriz)) {
    const u = usuarios.find((x) => x.id === usuarioId);
    if (!u) continue; // usuario dado de baja: su fila de la matriz se deja como está
    const set = new Set(columnas);

    if (EMPRESA_A_TODOS_LOS_QUE_YA_RECIBEN && !set.has("impuestos")) {
      set.add("impuestos");
      cambios.push(`  + ${nombreDe(u)} → Impuestos (empresa)`);
    }
    if (idsPersonales.has(usuarioId) && !set.has("impuestos_personales")) {
      set.add("impuestos_personales");
      cambios.push(`  + ${nombreDe(u)} → Impuestos personales`);
    }
    // Nadie más recibe el personal: si alguien lo tenía tildado sin estar en la
    // lista, se le saca. La lista de Nicolás es la fuente de verdad.
    if (!idsPersonales.has(usuarioId) && set.has("impuestos_personales")) {
      set.delete("impuestos_personales");
      cambios.push(`  − ${nombreDe(u)} → Impuestos personales (no está en la lista)`);
    }
    matriz[usuarioId] = [...set].filter((c) => COLUMNAS_TODAS.includes(c));
  }

  // Los de la lista personal que todavía no tienen ninguna fila en la matriz.
  for (const u of faltantes) {
    if (matriz[u.id]) continue;
    matriz[u.id] = ["impuestos", "impuestos_personales"];
    cambios.push(`  + ${nombreDe(u)} → Impuestos + Impuestos personales (fila nueva)`);
  }

  console.log("\nMatriz de notificaciones (preferencia):");
  console.log(cambios.length ? cambios.join("\n") : "  = ya estaba todo tildado");

  if (APLICAR && cambios.length > 0) {
    const { error } = await sb
      .from("parametros_sistema")
      .update({ valor: JSON.stringify(matriz) })
      .eq("clave", MATRIZ_CLAVE);
    if (error) console.log(`  ✗ ${error.message}`);
  }

  // ── 3) Los toggles de categoría, explícitos ──────────────────────────────
  console.log("\nToggles de categoría:");
  for (const clave of ["alerta_impuestos_activa", "alerta_impuestos_personales_activa"]) {
    const { data } = await sb
      .from("parametros_sistema")
      .select("valor")
      .eq("clave", clave)
      .maybeSingle();
    if (data?.valor === "true") {
      console.log(`  = ${clave} ya estaba en true`);
      continue;
    }
    console.log(`  + ${clave} = true`);
    if (APLICAR) {
      const { error } = await sb
        .from("parametros_sistema")
        .upsert({ clave, valor: "true", categoria: "notificaciones" }, { onConflict: "clave" });
      if (error) console.log(`    ✗ ${error.message}`);
    }
  }

  // ── 4) Comprobación final: quién va a recibir cada cosa ──────────────────
  // El permiso manda sobre la preferencia. Si alguien queda tildado sin poder,
  // el correo no le llega y conviene verlo acá y no descubrirlo en un mes.
  const puedenPersonal = await getUsuariosConSeccionCon(sb, "impuestos_personales", "read");
  const puedenEmpresa = await getUsuariosConSeccionCon(sb, "impuestos", "read");

  const listar = (columna: string, pueden: Set<string>) =>
    usuarios
      .filter((u) => (matriz[u.id] ?? []).includes(columna))
      .map((u) => `${nombreDe(u)}${pueden.has(u.id) ? "" : "  ⚠ tildado pero SIN permiso"}`);

  console.log("\n── Con esto, el correo de IMPUESTOS (empresa) le va a llegar a:");
  for (const l of listar("impuestos", puedenEmpresa)) console.log(`  · ${l}`);
  console.log("\n── Y el de IMPUESTOS PERSONALES (Joaquín Nicolás), sólo a:");
  for (const l of listar("impuestos_personales", puedenPersonal)) console.log(`  · ${l}`);

  if (!APLICAR) {
    console.log(
      "\n(dry-run: no se escribió nada. Los ⚠ de arriba son esperables acá — el permiso" +
        " se otorga en el paso 1, que en dry-run tampoco corrió.)",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
