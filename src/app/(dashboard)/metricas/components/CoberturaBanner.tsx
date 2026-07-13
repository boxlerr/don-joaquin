"use client";

// Cobertura de datos del mes: dice EXACTAMENTE qué falta (planillas sin
// datos, comparaciones no disponibles, meses vacíos en la ventana) en vez de
// dejar huecos silenciosos en el dashboard.

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { MetricasData } from "../actions";
import { mesLabel, addM, numAr } from "./format";

type Item = { ok: boolean; label: string; detalle?: string; href?: string; hrefLabel?: string };

export function calcularCobertura(data: MetricasData): Item[] {
  const ch = data.choferes;

  // Mes EN VIVO: la cobertura dice qué falta cargar EN EL SISTEMA para tener
  // las métricas completas, con link a la sección donde se carga cada cosa.
  if (data.esLive) {
    const li = data.liveInfo;
    const items: Item[] = [
      {
        ok: false, label: "Sueldo s/ facturación",
        detalle: "no sale de los viajes: llega con la planilla del Drive (los sueldos del sistema se cargan en Sueldos admin)",
        href: "/sueldos-admin", hrefLabel: "Sueldos admin",
      },
      {
        ok: false, label: "KM al 100%",
        detalle: "no se registra en la hoja de ruta: llega con la planilla del Drive",
      },
      {
        ok: data.serieCosto.some((r) => r.mes === data.mes && r.costoKm != null),
        label: "Costo estudio $/km",
        detalle: "llega con la planilla COSTO VS KM",
      },
    ];
    if (li) {
      if (li.sinChofer > 0) items.push({
        ok: false, label: `${numAr(li.sinChofer)} ${li.sinChofer === 1 ? "viaje" : "viajes"} sin chofer asignado`,
        detalle: "cuentan en los totales pero no en la tabla por chofer",
        href: "/viajes", hrefLabel: "Asignar en Viajes",
      });
      if (li.sinKm > 0) items.push({
        ok: false, label: `${numAr(li.sinKm)} ${li.sinKm === 1 ? "viaje" : "viajes"} sin km cargados`,
        detalle: "faltan en KM totales y distorsionan $/km",
        href: "/viajes", hrefLabel: "Completar en Viajes",
      });
      if (li.sinFlete > 0) items.push({
        ok: false, label: `${numAr(li.sinFlete)} ${li.sinFlete === 1 ? "viaje" : "viajes"} sin monto de flete`,
        detalle: "faltan en la facturación del mes",
        href: "/viajes", hrefLabel: "Completar en Viajes",
      });
      if (li.sinTonelaje > 0) items.push({
        ok: false, label: `${numAr(li.sinTonelaje)} ${li.sinTonelaje === 1 ? "viaje" : "viajes"} sin tonelaje`,
        detalle: "bajan el promedio de toneladas",
        href: "/viajes", hrefLabel: "Completar en Viajes",
      });
    }
    return items;
  }

  const tieneKm = ch.some((c) => c.km > 0);
  const tieneFact = ch.some((c) => c.facturacion > 0);
  const tieneTon = ch.some((c) => c.toneladas > 0);
  const tieneSueldo = ch.some((c) => c.sueldoTotal > 0);
  const tieneDesglose = ch.some((c) => c.retenciones != null);
  const costoMes = data.serieCosto.find((r) => r.mes === data.mes);

  const items: Item[] = [
    { ok: tieneFact && tieneKm, label: "Facturación por km" },
    { ok: tieneKm, label: "KM vacíos" },
    { ok: tieneKm, label: "KM al 100%" },
    { ok: tieneTon, label: "Toneladas", detalle: tieneTon ? undefined : "la planilla del mes no trae toneladas" },
    {
      ok: tieneSueldo, label: "Sueldo s/ facturación",
      detalle: tieneSueldo && !tieneDesglose ? "sin desglose de retenciones" : undefined,
    },
    {
      ok: costoMes?.costoKm != null, label: "Costo estudio $/km",
      detalle: costoMes?.costoKm == null ? "la planilla COSTO VS KM no tiene este mes" : undefined,
    },
    {
      ok: data.mesAnterior != null, label: "Comparación vs mes anterior",
      detalle: data.mesAnterior == null ? `falta cargar ${mesLabel(addM(data.mes, -1))}` : undefined,
    },
    {
      ok: data.anioAnterior != null, label: "Comparación interanual",
      detalle: data.anioAnterior == null ? `falta cargar ${mesLabel(addM(data.mes, -12))}` : undefined,
    },
  ];

  // Huecos en la serie histórica (afectan la pestaña Evolución y sparklines).
  const huecos = data.serieHistorica.filter((s) => s.general == null).map((s) => mesLabel(s.mes));
  if (huecos.length) {
    items.push({
      ok: false, label: "Serie histórica incompleta",
      detalle: `sin datos: ${huecos.join(", ")}`,
    });
  }

  return items;
}

export default function CoberturaBanner({ data }: { data: MetricasData }) {
  const [abierto, setAbierto] = useState(false);
  const items = useMemo(() => calcularCobertura(data), [data]);
  const faltantes = items.filter((i) => !i.ok || i.detalle);

  if (!data.choferes.length) return null; // el estado vacío lo maneja el shell

  if (!faltantes.length) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 size={13} className="text-emerald-500" />
        Datos del mes completos: las 6 planillas cargadas y ambas comparaciones disponibles.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="flex w-full items-center gap-2 text-left text-xs font-medium text-amber-700 dark:text-amber-400"
      >
        <AlertTriangle size={13} className="shrink-0" />
        <span className="flex-1">
          Faltan datos este mes: {faltantes.map((f) => f.label).join(" · ")}
        </span>
        {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {abierto && (
        <ul className="mt-2 space-y-1 pl-5">
          {items.map((i) => (
            <li key={i.label} className="flex items-start gap-1.5 text-[11px]">
              {i.ok && !i.detalle
                ? <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-500" />
                : <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />}
              <span className={i.ok && !i.detalle ? "text-muted-foreground" : "text-foreground"}>
                {i.label}
                {i.detalle && <span className="text-muted-foreground"> — {i.detalle}</span>}
                {i.href && (
                  <>
                    {" · "}
                    <Link href={i.href} className="font-medium text-primary hover:underline">
                      {i.hrefLabel ?? "Ir"}
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
          <li className="pt-1 text-[11px] text-muted-foreground">
            {data.esLive
              ? "Las métricas se completan al 100% cargando los viajes del mes en el sistema y con las planillas del Drive."
              : "Las planillas se importan desde el Drive de Bárbara con scripts/cargar-metricas-drive.ts."}
          </li>
        </ul>
      )}
    </div>
  );
}
