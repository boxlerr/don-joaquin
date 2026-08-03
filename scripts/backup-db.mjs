// Backup completo de la base de Don Joaquin: datos de todas las tablas, usuarios
// de auth, archivos de Storage y el esquema (las migraciones). Sólo lectura.
//
//   node scripts/backup-db.mjs                 → backup completo a backups/<fecha>/
//   node scripts/backup-db.mjs --sin-archivos  → saltea la descarga de Storage
//   node scripts/backup-db.mjs --con-vistas    → incluye las vistas v_* (derivadas)
//
// Ojo con el corte de 1000 filas de Supabase: acá se pagina y además se verifica
// contra el count exacto, así que un backup incompleto falla en vez de mentir.
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = readFileSync(join(root, ".env"), "utf8");
const URL_SB = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const sb = createClient(URL_SB, KEY, { auth: { persistSession: false } });

const sinArchivos = process.argv.includes("--sin-archivos");
const conVistas = process.argv.includes("--con-vistas");
const PAGINA = 1000; // el max_rows de PostgREST

const sello = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const dir = join(root, "backups", sello);
mkdirSync(join(dir, "datos"), { recursive: true });

const auth = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const fallos = [];

// 1. Descubrir qué hay: PostgREST publica el catálogo en su OpenAPI.
const spec = await fetch(`${URL_SB}/rest/v1/`, { headers: auth }).then((r) => r.json());
const entidades = Object.entries(spec.definitions ?? {})
  .map(([nombre, def]) => ({
    nombre,
    esVista: nombre.startsWith("v_"),
    // El spec marca las PK en la descripción de cada columna: las usamos para
    // paginar con un orden estable (sin orden, el offset puede saltear filas).
    pks: Object.entries(def.properties ?? {})
      .filter(([, p]) => (p.description ?? "").includes("<pk/>"))
      .map(([col]) => col),
  }))
  .filter((e) => conVistas || !e.esVista)
  .sort((a, b) => a.nombre.localeCompare(b.nombre));

console.log(`Backup → backups/${sello}`);
console.log(`${entidades.length} entidades a copiar\n`);

// 2. Datos, tabla por tabla.
const tablas = {};
let filasTotales = 0;

for (const { nombre, esVista, pks } of entidades) {
  const orden = pks.length ? pks : Object.keys(spec.definitions[nombre].properties ?? {}).slice(0, 1);
  const filas = [];
  let esperadas = null;

  try {
    for (let desde = 0; ; desde += PAGINA) {
      let q = sb.from(nombre).select("*", { count: "exact" }).range(desde, desde + PAGINA - 1);
      for (const col of orden) q = q.order(col);
      const { data, count, error } = await q;
      if (error) throw new Error(error.message);
      if (esperadas === null) esperadas = count;
      filas.push(...data);
      if (data.length < PAGINA) break;
    }

    // Un backup que se queda corto en silencio no sirve de nada.
    if (esperadas !== null && filas.length !== esperadas) {
      throw new Error(`incompleta: ${filas.length} filas de ${esperadas}`);
    }

    writeFileSync(join(dir, "datos", `${nombre}.json`), JSON.stringify(filas));
    tablas[nombre] = { filas: filas.length, vista: esVista };
    filasTotales += filas.length;
    console.log(`  ${nombre.padEnd(38)} ${String(filas.length).padStart(6)} filas${esVista ? "  (vista)" : ""}`);
  } catch (e) {
    fallos.push(`tabla ${nombre}: ${e.message}`);
    console.log(`  ${nombre.padEnd(38)} ERROR: ${e.message}`);
  }
}

// 3. Usuarios de auth (no pasan por PostgREST, van por la Admin API).
const usuarios = [];
try {
  for (let page = 1; ; page++) {
    const r = await fetch(`${URL_SB}/auth/v1/admin/users?page=${page}&per_page=200`, { headers: auth });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const { users } = await r.json();
    usuarios.push(...users);
    if (users.length < 200) break;
  }
  mkdirSync(join(dir, "auth"), { recursive: true });
  writeFileSync(join(dir, "auth", "users.json"), JSON.stringify(usuarios, null, 2));
  console.log(`\n  auth.users${" ".repeat(28)} ${String(usuarios.length).padStart(6)} usuarios`);
} catch (e) {
  fallos.push(`auth.users: ${e.message}`);
  console.log(`\n  auth.users  ERROR: ${e.message}`);
}

// 4. Storage: metadata de todos los objetos + los archivos en sí.
const objetos = [];
try {
  const buckets = await fetch(`${URL_SB}/storage/v1/bucket`, { headers: auth }).then((r) => r.json());

  // La API de list no es recursiva: las "carpetas" vuelven con id nulo.
  const recorrer = async (bucket, prefijo = "") => {
    for (let offset = 0; ; offset += 100) {
      const r = await fetch(`${URL_SB}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefix: prefijo, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
      });
      const items = await r.json();
      for (const it of items) {
        const ruta = prefijo ? `${prefijo}/${it.name}` : it.name;
        if (it.id) objetos.push({ bucket, ruta, tamano: it.metadata?.size ?? null, tipo: it.metadata?.mimetype ?? null, creado: it.created_at });
        else await recorrer(bucket, ruta);
      }
      if (items.length < 100) break;
    }
  };
  for (const b of buckets) await recorrer(b.name);

  mkdirSync(join(dir, "storage"), { recursive: true });
  writeFileSync(join(dir, "storage", "objetos.json"), JSON.stringify({ buckets, objetos }, null, 2));
  console.log(`  storage${" ".repeat(31)} ${String(objetos.length).padStart(6)} archivos`);

  if (!sinArchivos) {
    for (const o of objetos) {
      const destino = join(dir, "storage", "archivos", o.bucket, o.ruta);
      mkdirSync(dirname(destino), { recursive: true });
      const r = await fetch(`${URL_SB}/storage/v1/object/${o.bucket}/${o.ruta}`, { headers: auth });
      if (!r.ok) {
        fallos.push(`storage ${o.bucket}/${o.ruta}: HTTP ${r.status}`);
        continue;
      }
      writeFileSync(destino, Buffer.from(await r.arrayBuffer()));
    }
    console.log(`  archivos descargados${" ".repeat(18)} ${String(objetos.length - fallos.filter((f) => f.startsWith("storage ")).length).padStart(6)}`);
  }
} catch (e) {
  fallos.push(`storage: ${e.message}`);
  console.log(`  storage  ERROR: ${e.message}`);
}

// 5. El esquema: las migraciones son la fuente de verdad del DDL.
if (existsSync(join(root, "supabase", "migrations"))) {
  cpSync(join(root, "supabase", "migrations"), join(dir, "esquema", "migrations"), { recursive: true });
}

// 6. Manifiesto, para poder verificar una restauración contra esto.
writeFileSync(
  join(dir, "manifest.json"),
  JSON.stringify(
    {
      fecha: new Date().toISOString(),
      proyecto: new URL(URL_SB).host.split(".")[0],
      incluye_vistas: conVistas,
      incluye_archivos: !sinArchivos,
      totales: { tablas: Object.keys(tablas).length, filas: filasTotales, usuarios: usuarios.length, archivos: objetos.length },
      tablas,
      fallos,
    },
    null,
    2,
  ),
);

// 7. Y un README, porque dentro de seis meses nadie se acuerda qué hay acá.
writeFileSync(
  join(dir, "README.md"),
  `# Backup de la base de Don Joaquin — ${new Date().toISOString().slice(0, 10)}

## Qué hay acá

- \`datos/\` — un JSON por tabla (array de filas, tal cual salen de la base).
- \`auth/users.json\` — los usuarios que pueden entrar al sistema.
- \`storage/\` — \`objetos.json\` con la metadata y \`archivos/<bucket>/…\` con los archivos.
- \`esquema/migrations/\` — el DDL completo (tablas, funciones, triggers, RLS, índices, enums).
- \`manifest.json\` — conteos por tabla, para verificar una restauración contra esto.

## Qué NO cubre

- **Las contraseñas de los usuarios.** La API no las entrega. Si se restaura desde
  cero, los usuarios entran con "olvidé mi contraseña" o se los vuelve a invitar.
- **Cambios de esquema hechos a mano en el dashboard** sin su migración: el DDL
  acá es el de \`supabase/migrations\`, no un volcado del esquema real.

Para un backup que sí cubra las dos cosas hace falta \`pg_dump\` con la contraseña
de la base (Dashboard → Settings → Database).

## Restaurar

Con la base vacía: correr las migraciones (\`supabase db push\`) y después insertar
los JSON de \`datos/\` **en orden de dependencias** (padres antes que hijos, por las
FK). Los archivos de \`storage/archivos/\` se resuben a sus buckets.
`,
);

console.log(`\n${filasTotales} filas en ${Object.keys(tablas).length} tablas, ${usuarios.length} usuarios, ${objetos.length} archivos`);
console.log(`→ backups/${sello}`);

if (fallos.length) {
  console.log(`\n${fallos.length} FALLO(S) — el backup está incompleto:`);
  for (const f of fallos) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("Backup completo, sin fallos.");
