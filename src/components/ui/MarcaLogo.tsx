"use client";

/**
 * La imagen de una unidad: su foto si se la sacaron y, si no, el logo de la marca.
 *
 * Es la "foto de perfil" del camión en todo el sistema — la lista de flota, los
 * legajos, el resumen de viajes y el checklist de Compliance dibujan la misma,
 * así que una unidad se reconoce igual en todas las pantallas.
 *
 * Todas las filas tenían el mismo ícono de camioncito, así que no se distinguía
 * un Scania de un Iveco sin leer la columna. Con el logo se reconoce de un
 * vistazo, que es como se mira una lista de 62 unidades.
 *
 * Los logos son de proporciones muy distintas (la estrella de Mercedes es
 * cuadrada, el wordmark de IVECO es 6:1), así que se ajustan por alto y se
 * centran, igual que los de los bancos en Préstamos.
 */

import { Truck } from "lucide-react";
import { normalizar } from "@/app/(dashboard)/camiones/filtros";

/** Archivo en /public/marcas por marca, con las grafías que aparecen cargadas. */
const LOGOS: Record<string, string> = {
  scania: "/marcas/scania.svg",
  iveco: "/marcas/iveco.svg",
  volvo: "/marcas/volvo.svg",
  "mercedes benz": "/marcas/mercedes.svg",
  mercedes: "/marcas/mercedes.svg",
  "mercedes benz argentina": "/marcas/mercedes.svg",
  mb: "/marcas/mercedes.svg",
};

export function logoDeMarca(marca: string | null | undefined): string | null {
  if (!marca) return null;
  const clave = normalizar(marca);
  if (LOGOS[clave]) return LOGOS[clave]!;
  // "Scania P310" o "Iveco S-Way": alcanza con que arranque con la marca.
  for (const [k, v] of Object.entries(LOGOS)) {
    if (clave.startsWith(`${k} `)) return v;
  }
  return null;
}

export default function MarcaLogo({
  marca,
  foto,
  patente,
  size = 40,
}: {
  marca: string | null | undefined;
  /** Si la unidad tiene foto cargada, gana: es la unidad de verdad. */
  foto?: string | null;
  patente: string;
  size?: number;
}) {
  const logo = logoDeMarca(marca);

  if (foto) {
    return (
      <div
        className="shrink-0 overflow-hidden rounded-full border border-border bg-muted"
        style={{ width: size, height: size }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto} alt={patente} className="size-full object-cover" loading="lazy" />
      </div>
    );
  }

  if (logo) {
    return (
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-card"
        style={{ width: size, height: size }}
        title={marca ?? undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- SVG local */}
        <img
          src={logo}
          alt=""
          className="max-h-full max-w-full object-contain"
          // El de Scania es el logo completo (escudo + la palabra), así que
          // necesita casi todo el círculo para que se lea.
          style={{ maxHeight: size * 0.74, maxWidth: size * 0.86 }}
          loading="lazy"
        />
      </div>
    );
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border border-[#B3E5FC] bg-[#E1F5FE]"
      style={{ width: size, height: size }}
    >
      <Truck size={Math.round(size * 0.45)} className="text-primary" />
    </div>
  );
}
