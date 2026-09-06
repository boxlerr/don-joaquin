"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasSeccion, requireSeccion, type CurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  COLUMNA_IMPUESTOS_EMPRESA,
  COLUMNA_IMPUESTOS_PERSONALES,
  codigoContribuyente,
  esReservado,
  normalizarCuit,
  requierePermisoPersonales,
} from "@/domain/impuestos/entidades";
import type {
  ContribuyenteAdmin,
  ContribuyenteInput,
  ContribuyentesAdminData,
} from "./contribuyentes-tipos";

// ---------------------------------------------------------------------------
// Alta, edición y baja de contribuyentes (pedido de Julián, 03/09/2026).
//
// Hasta hoy la lista de contribuyentes era de sólo lectura: los dos que hay los
// creó la migración del 02/09 y la única forma de sumar uno era subir un PDF con
// un CUIT desconocido. Se podía dar de alta pero no corregir un nombre, que es
// justo lo que más se necesita.
//
// Lo delicado no es el CRUD, es `columna_alerta`: ese campo es lo único que
// separa "esto lo espera todo el equipo" de "esto lo ven tres personas". Por eso
// cada acción cruza DOS permisos —«Impuestos» para escribir, «Impuestos
// personales» para que el dato reservado se pueda tocar— y `requierePermisoPersonales`
// mira las dos puntas del cambio, no sólo dónde está parado el contribuyente hoy.
// ---------------------------------------------------------------------------

// `impuesto_entidades` es tabla nueva; se accede con `as any` hasta regenerar database.ts.
/* eslint-disable @typescript-eslint/no-explicit-any */

type EntidadDb = { codigo: string; nombre: string; cuit: string; columna_alerta: string };

/**
 * El motivo por el que este usuario no puede tocar este contribuyente, o `null`.
 *
 * Se le pasa la columna que TENDRÍA después del cambio: sin eso, alguien sin la
 * sección podría crear un contribuyente reservado, o —al revés— agarrar el de
 * Nicolás y ponerlo a avisarle a los nueve de administración.
 */
function motivoSinPermiso(
  user: CurrentUser,
  actual: string | null | undefined,
  nueva?: string | null | undefined,
): string | null {
  if (!requierePermisoPersonales(actual, nueva)) return null;
  if (hasSeccion(user, "impuestos_personales", "write")) return null;
  return "Los contribuyentes personales son de acceso reservado. Pedile a un administrador la sección «Impuestos personales» desde /usuarios.";
}

/** Valida y normaliza lo que llegó del formulario. */
function limpiarInput(input: ContribuyenteInput): { ok: ContribuyenteInput } | { error: string } {
  const nombre = input.nombre.trim();
  if (nombre.length < 2) return { error: "El nombre del contribuyente es obligatorio." };
  if (nombre.length > 120) return { error: "El nombre es demasiado largo." };

  const cuit = normalizarCuit(input.cuit);
  if (!cuit) return { error: "El CUIT tiene que tener 11 dígitos (ej: 30-70908728-9)." };

  // Sólo las dos que existen: cualquier otra caería en el prefijo cerrado de las
  // alertas y el contribuyente quedaría mudo sin que nadie se entere.
  const columnaAlerta = esReservado(input.columnaAlerta)
    ? COLUMNA_IMPUESTOS_PERSONALES
    : COLUMNA_IMPUESTOS_EMPRESA;

  return { ok: { nombre, cuit, columnaAlerta } };
}

async function traerEntidad(supabase: any, codigo: string): Promise<EntidadDb | null> {
  const { data } = await supabase
    .from("impuesto_entidades")
    .select("codigo, nombre, cuit, columna_alerta")
    .eq("codigo", codigo)
    .maybeSingle();
  return (data as EntidadDb | null) ?? null;
}

/**
 * Los contribuyentes con cuántos vencimientos tiene cada uno.
 *
 * Los reservados no se le devuelven a quien no tiene la sección: el CUIT de una
 * persona física es el dato que la sección protege, y una lista que lo muestra
 * "sólo para elegir" lo muestra igual.
 */
export async function getContribuyentesAdminAction(): Promise<ContribuyentesAdminData> {
  const user = await requireSeccion("impuestos", "read");
  const puedeVerPersonales = hasSeccion(user, "impuestos_personales", "read");
  const supabase = createAdminClient();

  const { data: ents } = await (supabase as any)
    .from("impuesto_entidades")
    .select("codigo, nombre, cuit, columna_alerta")
    .order("orden", { ascending: true });

  const visibles = ((ents ?? []) as EntidadDb[]).filter(
    (e) => puedeVerPersonales || !esReservado(e.columna_alerta),
  );

  // Un `count` por contribuyente y no una lectura de la tabla entera: Supabase
  // corta en 1000 filas sin avisar, y en un año el calendario pasa esa marca.
  // Con `head: true` ni siquiera viajan las filas.
  const cuentas = await Promise.all(
    visibles.map(async (e) => {
      const { count } = await (supabase as any)
        .from("impuesto_vencimientos")
        .select("id", { count: "exact", head: true })
        .eq("entidad_codigo", e.codigo);
      return count ?? 0;
    }),
  );

  const items: ContribuyenteAdmin[] = visibles.map((e, i) => ({
    codigo: e.codigo,
    nombre: e.nombre,
    cuit: e.cuit,
    columnaAlerta: e.columna_alerta,
    vencimientos: cuentas[i] ?? 0,
  }));

  return {
    items,
    puedeVerPersonales,
    puedePersonales: hasSeccion(user, "impuestos_personales", "write"),
  };
}

export async function crearContribuyenteAction(
  input: ContribuyenteInput,
): Promise<{ ok: true; codigo: string } | { error: string }> {
  const user = await requireSeccion("impuestos", "write");
  const limpio = limpiarInput(input);
  if ("error" in limpio) return limpio;
  const { nombre, cuit, columnaAlerta } = limpio.ok;

  // Al crear no hay "columna actual": la que manda es la que se está eligiendo.
  const sinPermiso = motivoSinPermiso(user, columnaAlerta, columnaAlerta);
  if (sinPermiso) return { error: sinPermiso };

  const supabase = createAdminClient();
  const { data: todos } = await (supabase as any)
    .from("impuesto_entidades")
    .select("codigo, nombre, cuit, columna_alerta, orden");
  const existentes = (todos ?? []) as (EntidadDb & { orden: number })[];

  // El CUIT es único en la base y es la llave con la que el importador reconoce
  // el PDF. Se avisa acá con el nombre del que ya está, en vez de devolver el
  // error crudo de Postgres — que en pantalla no dice a quién pisaría.
  const repetido = existentes.find((e) => e.cuit === cuit);
  if (repetido) {
    // Si el repetido es uno reservado y quien mira no lo puede ver, tampoco se
    // le nombra: sería confirmarle que ese CUIT está cargado y de quién es.
    return esReservado(repetido.columna_alerta) && !hasSeccion(user, "impuestos_personales", "read")
      ? { error: "Ese CUIT ya está dado de alta." }
      : { error: `Ese CUIT ya es de «${repetido.nombre}».` };
  }

  const codigo = codigoContribuyente(
    nombre,
    cuit,
    existentes.map((e) => e.codigo),
  );
  const orden = existentes.reduce((max, e) => Math.max(max, e.orden ?? 0), 0) + 10;

  const { error } = await (supabase as any).from("impuesto_entidades").insert({
    codigo,
    nombre,
    cuit,
    columna_alerta: columnaAlerta,
    orden,
  });
  if (error) return { error: "No se pudo dar de alta el contribuyente." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "crear",
    entidadTipo: "impuesto_entidad",
    entidadId: codigo,
    valoresNuevos: { nombre, cuit, columna_alerta: columnaAlerta },
  });

  revalidatePath("/impuestos");
  return { ok: true, codigo };
}

export async function actualizarContribuyenteAction(
  codigo: string,
  input: ContribuyenteInput,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("impuestos", "write");
  const limpio = limpiarInput(input);
  if ("error" in limpio) return limpio;
  const { nombre, cuit, columnaAlerta } = limpio.ok;

  const supabase = createAdminClient();
  const previo = await traerEntidad(supabase, codigo);
  if (!previo) return { error: "No se encontró el contribuyente." };

  const sinPermiso = motivoSinPermiso(user, previo.columna_alerta, columnaAlerta);
  if (sinPermiso) return { error: sinPermiso };

  if (cuit !== previo.cuit) {
    const { data: choca } = await (supabase as any)
      .from("impuesto_entidades")
      .select("nombre, columna_alerta")
      .eq("cuit", cuit)
      .neq("codigo", codigo)
      .maybeSingle();
    if (choca) {
      return esReservado(choca.columna_alerta) &&
        !hasSeccion(user, "impuestos_personales", "read")
        ? { error: "Ese CUIT ya está dado de alta." }
        : { error: `Ese CUIT ya es de «${choca.nombre}».` };
    }
  }

  const { error } = await (supabase as any)
    .from("impuesto_entidades")
    .update({ nombre, cuit, columna_alerta: columnaAlerta })
    .eq("codigo", codigo);
  if (error) return { error: "No se pudo guardar el contribuyente." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "actualizar",
    entidadTipo: "impuesto_entidad",
    entidadId: codigo,
    valoresAnteriores: {
      nombre: previo.nombre,
      cuit: previo.cuit,
      columna_alerta: previo.columna_alerta,
    },
    valoresNuevos: { nombre, cuit, columna_alerta: columnaAlerta },
    // Es EL cambio que hay que poder reconstruir después: de un renglón de
    // auditoría tiene que salir el día en que un calendario dejó de ser reservado.
    metadata:
      previo.columna_alerta !== columnaAlerta
        ? { evento: esReservado(columnaAlerta) ? "paso_a_reservado" : "dejo_de_ser_reservado" }
        : undefined,
  });

  revalidatePath("/impuestos");
  return { ok: true };
}

/**
 * Baja. Sólo si no tiene nada agendado.
 *
 * El borrado en cascada se llevaría vencimientos presentados, con importe, fecha
 * de pago y los comprobantes escaneados colgando de ellos — el registro de lo
 * que se presentó, no una fila de catálogo. Con vencimientos cargados el
 * contribuyente no se borra desde acá y la pantalla lo dice con el número.
 */
export async function eliminarContribuyenteAction(
  codigo: string,
): Promise<{ ok: true } | { error: string }> {
  const user = await requireSeccion("impuestos", "write");
  const supabase = createAdminClient();

  const previo = await traerEntidad(supabase, codigo);
  if (!previo) return { error: "No se encontró el contribuyente." };

  const sinPermiso = motivoSinPermiso(user, previo.columna_alerta);
  if (sinPermiso) return { error: sinPermiso };

  const { count } = await (supabase as any)
    .from("impuesto_vencimientos")
    .select("id", { count: "exact", head: true })
    .eq("entidad_codigo", codigo);
  if ((count ?? 0) > 0) {
    return {
      error: `«${previo.nombre}» tiene ${count} vencimiento${count === 1 ? "" : "s"} agendado${count === 1 ? "" : "s"}. Borralos primero: con ellos se irían los importes, las fechas de pago y los comprobantes adjuntos.`,
    };
  }

  // Quedarse sin ninguno rompe la carga: un vencimiento nuevo sin contribuyente
  // elegido cae en `joaquin_hnos` y la base lo rechaza si no existe.
  const { count: cuantos } = await (supabase as any)
    .from("impuesto_entidades")
    .select("codigo", { count: "exact", head: true });
  if ((cuantos ?? 0) <= 1) {
    return { error: "Tiene que quedar al menos un contribuyente para poder cargar impuestos." };
  }

  const { error } = await (supabase as any)
    .from("impuesto_entidades")
    .delete()
    .eq("codigo", codigo);
  if (error) return { error: "No se pudo eliminar el contribuyente." };

  await logAudit({
    client: supabase,
    usuarioId: user.id,
    accion: "eliminar",
    entidadTipo: "impuesto_entidad",
    entidadId: codigo,
    valoresAnteriores: {
      nombre: previo.nombre,
      cuit: previo.cuit,
      columna_alerta: previo.columna_alerta,
    },
  });

  revalidatePath("/impuestos");
  return { ok: true };
}
