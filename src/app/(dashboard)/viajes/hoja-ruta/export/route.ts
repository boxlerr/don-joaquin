import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { buildHojaRutaWorkbook, type ExportChofer, type ExportViaje } from "./build";

export const dynamic = "force-dynamic";

function rangoMes(mesISO: string): { desde: string; hasta: string; label: string } {
  if (mesISO === "total") {
    return { desde: "1900-01-01", hasta: "2999-12-31", label: "historico" };
  }
  if (!/^\d{4}-\d{2}$/.test(mesISO)) {
    const hoy = new Date();
    mesISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
  }
  const [y, m] = mesISO.split("-").map((x) => parseInt(x, 10));
  const last = new Date(y, m, 0).getDate();
  return {
    desde: `${y}-${String(m).padStart(2, "0")}-01`,
    hasta: `${y}-${String(m).padStart(2, "0")}-${String(last).padStart(2, "0")}`,
    label: mesISO,
  };
}

function extractMaterial(obs: string | null): string {
  if (!obs) return "";
  const m = obs.match(/Material:\s*([^·|]+)/i);
  return m ? m[1].trim() : "";
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET(req: NextRequest) {
  await requireSeccion("viajes_hoja_ruta", "read");

  const mesISO = req.nextUrl.searchParams.get("mes") ?? "";
  const { desde, hasta, label } = rangoMes(mesISO);
  const supabase = createAdminClient();
  const sb = supabase as any;

  // 1) Viajes del mes con joins (paginado: el REST corta en 1000).
  type ViajeRaw = {
    chofer_id: string;
    fecha_viaje: string;
    km_con_carga: number | null;
    km_vacios: number | null;
    tonelaje_real: number | null;
    nro_remito: string | null;
    nro_viaje_ypf: string | null;
    material: string | null;
    monto_flete: number | null;
    es_vacio: boolean | null;
    observaciones: string | null;
    origen: { nombre: string } | { nombre: string }[] | null;
    destino: { nombre: string } | { nombre: string }[] | null;
    camion: { patente: string; capacidad_tn: number | null } | { patente: string; capacidad_tn: number | null }[] | null;
  };
  const viajes: ViajeRaw[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await sb
      .from("viajes")
      .select(`
        chofer_id, fecha_viaje, km_con_carga, km_vacios, tonelaje_real,
        nro_remito, nro_viaje_ypf, material, monto_flete, es_vacio, observaciones,
        origen:puntos_ruta!viajes_origen_id_fkey(nombre),
        destino:puntos_ruta!viajes_destino_id_fkey(nombre),
        camion:camiones(patente, capacidad_tn)
      `)
      .gte("fecha_viaje", desde)
      .lte("fecha_viaje", hasta)
      .neq("estado", "cancelado") // los borrados (soft delete) no van al Excel
      .not("chofer_id", "is", null)
      .order("fecha_viaje", { ascending: true })
      // Desempate dentro del mismo día por orden de carga (código secuencial):
      // la ida antes que su vuelta vacía, igual que en la vista de hoja de ruta.
      .order("codigo", { ascending: true })
      .range(from, from + 999);
    const rows = (data ?? []) as ViajeRaw[];
    viajes.push(...rows);
    if (rows.length < 1000) break;
  }

  // 2) Choferes, camiones habituales y acoplados (para nombres + fila de patentes).
  const [{ data: choferesRaw }, { data: camionesRaw }, { data: vinculosRaw }, { data: acopladosRaw }] =
    await Promise.all([
      sb.from("choferes").select(
        "id, apellido, nombre, dni, cuil, telefono, telefono_emergencia, domicilio, localidad, provincia, fecha_ingreso",
      ),
      sb.from("camiones").select("id, patente, chofer_actual_id"),
      sb.from("camion_acoplados").select("camion_id, acoplado_id").is("hasta", null),
      sb.from("acoplados").select("id, patente"),
    ]);

  type ChoferFicha = {
    id: string;
    apellido: string;
    nombre: string;
    dni: string | null;
    cuil: string | null;
    telefono: string | null;
    telefono_emergencia: string | null;
    domicilio: string | null;
    localidad: string | null;
    provincia: string | null;
    fecha_ingreso: string | null;
  };
  const fichaChofer = new Map<string, ChoferFicha>();
  for (const c of (choferesRaw ?? []) as ChoferFicha[]) {
    fichaChofer.set(c.id, c);
  }

  const tractorPorChofer = new Map<string, { camionId: string; patente: string }>();
  for (const c of (camionesRaw ?? []) as { id: string; patente: string; chofer_actual_id: string | null }[]) {
    if (c.chofer_actual_id) tractorPorChofer.set(c.chofer_actual_id, { camionId: c.id, patente: c.patente });
  }
  const patenteAcoplado = new Map<string, string>();
  for (const a of (acopladosRaw ?? []) as { id: string; patente: string }[]) patenteAcoplado.set(a.id, a.patente);
  const acopladoPorCamion = new Map<string, string>();
  for (const v of (vinculosRaw ?? []) as { camion_id: string; acoplado_id: string }[]) {
    if (!acopladoPorCamion.has(v.camion_id)) {
      const pat = patenteAcoplado.get(v.acoplado_id);
      if (pat) acopladoPorCamion.set(v.camion_id, pat);
    }
  }

  // 3) Agrupar viajes por chofer.
  const porChofer = new Map<string, ExportViaje[]>();
  for (const v of viajes) {
    const ori = Array.isArray(v.origen) ? v.origen[0] : v.origen;
    const des = Array.isArray(v.destino) ? v.destino[0] : v.destino;
    const cam = Array.isArray(v.camion) ? v.camion[0] : v.camion;
    const item: ExportViaje = {
      fecha: (v.fecha_viaje ?? "").slice(0, 10),
      origen: ori?.nombre ?? "",
      destino: des?.nombre ?? "",
      km_con_carga: Number(v.km_con_carga ?? 0),
      km_vacios: Number(v.km_vacios ?? 0),
      capacidad: cam?.capacidad_tn ?? null,
      tonelaje: v.tonelaje_real != null ? Number(v.tonelaje_real) : null,
      remito: v.nro_remito ?? v.nro_viaje_ypf ?? "",
      material: v.material ?? extractMaterial(v.observaciones),
      importe: v.monto_flete != null ? Number(v.monto_flete) : null,
      es_vacio: !!v.es_vacio,
    };
    const arr = porChofer.get(v.chofer_id) ?? [];
    arr.push(item);
    porChofer.set(v.chofer_id, arr);
  }

  // 4) Armar la lista ordenada por apellido (una hoja por chofer con viajes).
  const choferes: ExportChofer[] = [...porChofer.entries()]
    .map(([choferId, vs]) => {
      const f = fichaChofer.get(choferId);
      const tractor = tractorPorChofer.get(choferId);
      return {
        apellido: f?.apellido ?? "CHOFER",
        nombre: f?.nombre ?? "",
        dni: f?.dni ?? "",
        cuil: f?.cuil ?? "",
        telefono: f?.telefono ?? "",
        telefonoEmergencia: f?.telefono_emergencia ?? "",
        domicilio: f?.domicilio ?? "",
        localidad: f?.localidad ?? "",
        provincia: f?.provincia ?? "",
        fechaIngreso: f?.fecha_ingreso ?? "",
        tractor: tractor?.patente ?? "",
        acoplado: tractor ? acopladoPorCamion.get(tractor.camionId) ?? "" : "",
        viajes: vs,
      };
    })
    .sort((a, b) => a.apellido.localeCompare(b.apellido, "es"));

  const buf = await buildHojaRutaWorkbook(choferes);
  const filename = `hoja-de-ruta_${label}.xlsx`;

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
