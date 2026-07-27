// Procedencia y estado de cada métrica: UNA sola fuente de verdad que responde
// tres preguntas por número — de qué sección sale, de qué campo, y si el dato
// está completo, incompleto o directamente no se puede obtener todavía.
//
// La alimentan el KpiCard (semáforo + fuente al pie), el panel "De dónde sale
// cada número" y el banner de cobertura, para que los tres digan lo mismo.

import type { MetricasData } from "../actions";
import { numAr } from "./format";

/** ok = completo · parcial = se calcula pero con huecos · no_obtenible = falta un parámetro estructural. */
export type EstadoDato = "ok" | "parcial" | "no_obtenible";

export type FuenteId = "hoja_ruta" | "planillas" | "sueldos_admin" | "estudio";

export type Fuente = {
  id: FuenteId;
  label: string;
  /** Qué es, en una línea. */
  que: string;
  /** Sección del sistema, si la tiene. */
  href: string | null;
  /** true → el sistema la genera solo con lo que ya se carga acá dentro. */
  automatica: boolean;
};

export const FUENTES: Record<FuenteId, Fuente> = {
  hoja_ruta: {
    id: "hoja_ruta",
    label: "Hoja de ruta",
    que: "Los viajes cargados en el sistema",
    href: "/viajes",
    automatica: true,
  },
  sueldos_admin: {
    id: "sueldos_admin",
    label: "Sueldos admin",
    que: "Sueldos de administración y taller cargados en el sistema",
    href: "/sueldos-admin",
    automatica: true,
  },
  planillas: {
    id: "planillas",
    label: "Planillas del Drive",
    que: "Los PDF mensuales que se arman fuera del sistema",
    href: null,
    automatica: false,
  },
  estudio: {
    id: "estudio",
    label: "Estudio contable",
    que: "El costo por km que pasa el contador cada mes",
    href: null,
    automatica: false,
  },
};

export type EstadoKpi = {
  estado: EstadoDato;
  fuente: Fuente;
  /** Campo concreto del que sale (para poder auditarlo). */
  campo: string;
  /** Explicación completa. Va al tooltip, no a la vista. Null si está completo. */
  nota: string | null;
  /**
   * Versión de 2-4 palabras de `nota`, para mostrar en línea sin saturar la
   * tarjeta ("10 sin monto", "no se obtiene"). Null si está completo.
   */
  notaCorta: string | null;
  /** A dónde ir a resolverlo. */
  accion: { label: string; href: string } | null;
  /**
   * true → el sistema la puede calcular solo con la hoja de ruta, sin depender
   * de las planillas del Drive. Es propiedad de la métrica, no del mes: sirve
   * para decir cuánto falta para que dejen de armar planillas a mano.
   */
  automatizable: boolean;
};

/** Las que el sistema ya sabe calcular desde los viajes. */
const AUTOMATIZABLES = new Set(["facturacion", "km", "factkm", "vacios", "toneladas"]);

/** Motivos de "no obtenible", escritos una sola vez. */
const NO_OBTENIBLE = {
  km100:
    "No se registra por viaje. Hoy solo llega con la planilla KM AL 100% del Drive, y su definición sigue sin confirmar con el cliente.",
  sueldoChoferes:
    "Los sueldos de choferes se liquidan fuera del sistema. Falta la tabla de tarifas por concepto (km, controles de descarga, sur, pozo).",
} as const;

const viajesLabel = (n: number, sufijo: string) =>
  `${numAr(n)} ${n === 1 ? "viaje" : "viajes"} ${sufijo}`;

/** Query del listado de viajes acotado al mes que se está viendo. */
function rangoMes(mesISO: string): string {
  const [y, m] = mesISO.split("-").map(Number);
  // Día 0 del mes siguiente = último día de este mes.
  const ultimo = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return `rango=custom&desde=${mesISO}&hasta=${y}-${mm}-${String(ultimo).padStart(2, "0")}`;
}

/**
 * Link al listado de viajes del mes, filtrado por el dato que falta. Es el que
 * responde "¿cuáles son esos 7 viajes sin km?" sin tener que buscarlos a mano.
 */
const irAViajes = (mes: string, falta?: "km" | "monto" | "tonelaje") => ({
  label: "Ver los viajes",
  href: `/viajes?${falta ? `falta=${falta}&` : ""}${rangoMes(mes)}`,
});

/** Igual que EstadoKpi pero sin el flag, que se agrega al final para todos. */
type EstadoBase = Omit<EstadoKpi, "automatizable">;

/**
 * Estado de cada KPI para el mes que se está viendo.
 * Clave: el `id` de KPIS en metricas-def.ts.
 */
export function estadoDeKpis(data: MetricasData): Record<string, EstadoKpi> {
  return Object.fromEntries(
    Object.entries(calcularEstados(data)).map(([id, e]) => [
      id,
      { ...e, automatizable: AUTOMATIZABLES.has(id) },
    ]),
  );
}

function calcularEstados(data: MetricasData): Record<string, EstadoBase> {
  const t = data.totales.general;
  const li = data.liveInfo;

  // ── Mes EN VIVO: todo sale de la hoja de ruta, y el hueco se mide en viajes
  //    incompletos. Sueldos y km al 100% no salen de los viajes.
  if (data.esLive) {
    type Parcial = Pick<EstadoBase, "estado" | "nota" | "notaCorta" | "accion">;
    const parcial = (n: number, sufijo: string, corto: string, falta: "km" | "monto" | "tonelaje"): Parcial =>
      n > 0
        ? {
            estado: "parcial",
            nota: viajesLabel(n, sufijo),
            notaCorta: `${numAr(n)} ${corto}`,
            accion: irAViajes(data.mes, falta),
          }
        : { estado: "ok", nota: null, notaCorta: null, accion: null };

    const hr = FUENTES.hoja_ruta;
    const sinFlete = li?.sinFlete ?? 0;
    const sinKm = li?.sinKm ?? 0;
    const sinTon = li?.sinTonelaje ?? 0;

    const sueldoChoferes: EstadoBase = {
      estado: "no_obtenible",
      fuente: FUENTES.planillas,
      campo: "planilla SUELDO S/ FACT.",
      nota: NO_OBTENIBLE.sueldoChoferes,
      notaCorta: "no se obtiene",
      accion: { label: "Ver sueldos de admin y taller", href: "/sueldos-admin" },
    };

    return {
      facturacion: { fuente: hr, campo: "monto de flete", ...parcial(sinFlete, "sin monto de flete", "sin monto", "monto") },
      km: { fuente: hr, campo: "km con carga + vacíos", ...parcial(sinKm, "sin km cargados", "sin km", "km") },
      factkm: {
        fuente: hr,
        campo: "facturación ÷ km",
        // Le pegan los dos huecos a la vez: se manda al mes completo, sin filtrar.
        ...(sinFlete + sinKm > 0
          ? {
              estado: "parcial" as const,
              nota: "arrastra los viajes sin monto y sin km",
              notaCorta: "datos incompletos",
              accion: irAViajes(data.mes),
            }
          : { estado: "ok" as const, nota: null, notaCorta: null, accion: null }),
      },
      vacios: { fuente: hr, campo: "km vacíos ÷ km totales", ...parcial(sinKm, "sin km cargados", "sin km", "km") },
      toneladas: { fuente: hr, campo: "tonelaje real", ...parcial(sinTon, "sin tonelaje", "sin tonelaje", "tonelaje") },
      km100: {
        estado: "no_obtenible",
        fuente: FUENTES.planillas,
        campo: "planilla KM AL 100%",
        nota: NO_OBTENIBLE.km100,
        notaCorta: "no se obtiene",
        accion: null,
      },
      sueldo: sueldoChoferes,
      sueldos_pesos: sueldoChoferes,
    };
  }

  // ── Mes con planillas cargadas: el hueco es una planilla que no trajo el dato.
  const ch = data.choferes;
  const hay = (f: (c: (typeof ch)[number]) => number) => ch.some((c) => f(c) > 0);
  const pl = FUENTES.planillas;

  const desde = (
    ok: boolean,
    campo: string,
    faltaMsg: string,
  ): EstadoBase => ({
    estado: ok ? "ok" : "no_obtenible",
    fuente: pl,
    campo,
    nota: ok ? null : faltaMsg,
    notaCorta: ok ? null : "no está en la planilla",
    accion: null,
  });

  const tieneSueldo = hay((c) => c.sueldoTotal);
  const sinDesglose = tieneSueldo && !ch.some((c) => c.retenciones != null);

  return {
    facturacion: desde(hay((c) => c.facturacion), "planilla FACTURACIÓN POR KM", "la planilla del mes no trae facturación"),
    km: desde(hay((c) => c.km), "planilla FACTURACIÓN POR KM", "la planilla del mes no trae km"),
    factkm: desde(t?.factPorKm != null, "facturación ÷ km", "faltan facturación o km en la planilla"),
    vacios: desde(hay((c) => c.kmVacios), "planilla KM VACIOS", "la planilla KM VACIOS no trae este mes"),
    km100: desde(hay((c) => c.km100), "planilla KM AL 100%", "la planilla KM AL 100% no trae este mes"),
    toneladas: desde(hay((c) => c.toneladas), "planilla TONELADAS", "la planilla TONELADAS no trae este mes"),
    sueldo: {
      estado: tieneSueldo ? (sinDesglose ? "parcial" : "ok") : "no_obtenible",
      fuente: pl,
      campo: "planilla SUELDO S/ FACT.",
      nota: !tieneSueldo
        ? "la planilla de sueldos no trae este mes"
        : sinDesglose
          ? "sin desglose de retenciones"
          : null,
      notaCorta: !tieneSueldo ? "no está en la planilla" : sinDesglose ? "sin desglose" : null,
      accion: null,
    },
    sueldos_pesos: {
      estado: tieneSueldo ? "ok" : "no_obtenible",
      fuente: pl,
      campo: "planilla SUELDO S/ FACT.",
      nota: tieneSueldo ? null : "la planilla de sueldos no trae este mes",
      notaCorta: tieneSueldo ? null : "no está en la planilla",
      accion: null,
    },
  };
}

/** Fila extra del panel: el costo $/km no es KPI pero sí un dato del mes. */
export function estadoCostoEstudio(data: MetricasData): EstadoKpi {
  const ok = data.serieCosto.some((r) => r.mes === data.mes && r.costoKm != null);
  return {
    estado: ok ? "ok" : "no_obtenible",
    fuente: FUENTES.estudio,
    campo: "planilla COSTO VS KM",
    nota: ok ? null : "el estudio de costo de este mes todavía no se cargó",
    notaCorta: ok ? null : "no se cargó",
    accion: null,
    automatizable: false, // lo arma el contador, no sale de los viajes
  };
}
