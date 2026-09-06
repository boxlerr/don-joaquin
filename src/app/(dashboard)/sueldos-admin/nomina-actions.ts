"use server";

// Lectura de la nómina del mes: lo que se le transfirió a cada persona y por qué
// banco salió cada parte.
//
// Es información confidencial de sueldos: se lee con service role desde acá, y
// la puerta es el permiso `sueldos_admin`.

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion } from "@/lib/auth";
import { traerTodo } from "@/lib/supabase/traer-todo";
import type { NominaMesResumen, NominaPersonaMes } from "./nomina-tipos";

// Las tablas de nómina no están en database.ts todavía.
/* eslint-disable @typescript-eslint/no-explicit-any */

/** Primer día del mes pedido (default: el mes actual). */
function primerDia(monthStr?: string): string {
  if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) return `${monthStr}-01`;
  const hoy = new Date();
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
}

export async function getNominaMesAction(month?: string): Promise<NominaMesResumen> {
  await requireSeccion("sueldos_admin", "read");
  const supabase = createAdminClient();
  const mes = primerDia(month);

  const [pagos, cabeceraRes, mesesRes] = await Promise.all([
    traerTodo<any>(
      (from, to) =>
        (supabase as any)
          .from("sueldos_nomina_pagos")
          .select("chofer_id, concepto, banco, importe, orden")
          .eq("mes", mes)
          .order("chofer_id")
          .range(from, to),
      { etiqueta: "pagos de la nómina del mes" },
    ),
    (supabase as any)
      .from("sueldos_nomina_meses")
      .select("archivo, total_sueldos, total_embargos, observaciones, updated_at")
      .eq("mes", mes)
      .maybeSingle(),
    (supabase as any).from("sueldos_nomina_meses").select("mes").order("mes", { ascending: false }),
  ]);

  const filas = (pagos ?? []) as {
    chofer_id: string;
    concepto: "sueldo" | "embargo";
    banco: string | null;
    importe: number;
    orden: number;
  }[];

  const mesesCargados = ((mesesRes.data ?? []) as { mes: string }[]).map((m) => m.mes);

  if (!filas.length) {
    return {
      mes,
      personas: [],
      bancos: [],
      total: 0,
      totalEmbargos: 0,
      totalExcel: cabeceraRes.data?.total_sueldos ?? null,
      archivo: cabeceraRes.data?.archivo ?? null,
      observaciones: cabeceraRes.data?.observaciones ?? null,
      mesesCargados,
    };
  }

  const ids = [...new Set(filas.map((f) => f.chofer_id))];
  const { data: chs } = await supabase
    .from("choferes")
    .select("id, nombre, apellido, rol, estado")
    .in("id", ids);
  const datos = new Map(
    ((chs ?? []) as any[]).map((c) => [
      c.id as string,
      { nombre: `${c.apellido}, ${c.nombre}`, rol: c.rol as string, estado: c.estado as string },
    ]),
  );

  const porPersona = new Map<string, NominaPersonaMes>();
  for (const f of filas) {
    const info = datos.get(f.chofer_id);
    let p = porPersona.get(f.chofer_id);
    if (!p) {
      p = {
        chofer_id: f.chofer_id,
        nombre: info?.nombre ?? "—",
        rol: info?.rol ?? "",
        egresado: info ? info.estado !== "activo" : false,
        bancos: [],
        total: 0,
        embargo: 0,
      };
      porPersona.set(f.chofer_id, p);
    }
    const importe = Number(f.importe ?? 0);
    if (f.concepto === "embargo") {
      p.embargo += importe;
      continue;
    }
    p.total += importe;
    p.bancos.push({ banco: f.banco, importe });
  }

  for (const p of porPersona.values()) {
    p.bancos.sort((a, b) => b.importe - a.importe);
  }

  // Resumen por banco: es lo que se usa para pagar (cuánto sale de cada cuenta).
  const porBanco = new Map<string, { personas: number; total: number }>();
  for (const f of filas) {
    if (f.concepto !== "sueldo") continue;
    const clave = f.banco ?? "";
    const acc = porBanco.get(clave) ?? { personas: 0, total: 0 };
    acc.personas++;
    acc.total += Number(f.importe ?? 0);
    porBanco.set(clave, acc);
  }

  const personas = [...porPersona.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

  return {
    mes,
    personas,
    bancos: [...porBanco.entries()]
      .map(([banco, v]) => ({ banco: banco || null, ...v }))
      .sort((a, b) => b.total - a.total),
    total: personas.reduce((s, p) => s + p.total, 0),
    totalEmbargos: personas.reduce((s, p) => s + p.embargo, 0),
    totalExcel: cabeceraRes.data?.total_sueldos ?? null,
    archivo: cabeceraRes.data?.archivo ?? null,
    observaciones: cabeceraRes.data?.observaciones ?? null,
    mesesCargados,
  };
}
