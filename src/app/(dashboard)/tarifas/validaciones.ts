import type { Database } from "@/types/database";

export type TarifaModalidad = Database["public"]["Enums"]["tarifa_modalidad"];

export const MODALIDADES: { value: TarifaModalidad; label: string; unidad: string; pista: string }[] = [
  { value: "fija", label: "Fija", unidad: "$", pista: "Monto fijo por viaje" },
  { value: "por_tonelada", label: "Por tonelada", unidad: "$/t", pista: "Multiplicado por toneladas" },
  { value: "por_kilo", label: "Por kilo", unidad: "$/kg", pista: "Multiplicado por kilos" },
  { value: "por_km", label: "Por kilómetro", unidad: "$/km", pista: "Multiplicado por KM oficiales" },
];

export function getModalidadMeta(modalidad: TarifaModalidad) {
  return MODALIDADES.find((m) => m.value === modalidad) ?? MODALIDADES[0]!;
}

export type TarifaInput = {
  cliente_id: string;
  ruta_id: string | null;
  modalidad: TarifaModalidad;
  valor: number;
  moneda: string;
  vigencia_desde: string;
  vigencia_hasta: string | null;
  observaciones: string | null;
};

export type ValidacionResult = { ok: true; data: TarifaInput } | { ok: false; error: string };

const MAX_VALOR = 100_000_000;
const MAX_OBS = 500;

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function isFecha(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
}

export function rutaEsObligatoria(modalidad: TarifaModalidad): boolean {
  return modalidad === "fija" || modalidad === "por_km";
}

export function validarTarifa(raw: {
  cliente_id?: unknown;
  ruta_id?: unknown;
  modalidad?: unknown;
  valor?: unknown;
  moneda?: unknown;
  vigencia_desde?: unknown;
  vigencia_hasta?: unknown;
  observaciones?: unknown;
}): ValidacionResult {
  const cliente_id = typeof raw.cliente_id === "string" ? raw.cliente_id.trim() : "";
  if (!isUuid(cliente_id)) return { ok: false, error: "Cliente inválido" };

  const modalidad = raw.modalidad as TarifaModalidad;
  if (!MODALIDADES.some((m) => m.value === modalidad)) {
    return { ok: false, error: "Modalidad inválida" };
  }

  const rutaRaw = typeof raw.ruta_id === "string" ? raw.ruta_id.trim() : "";
  const ruta_id = rutaRaw && rutaRaw !== "_sin_ruta" ? rutaRaw : null;
  if (ruta_id !== null && !isUuid(ruta_id)) {
    return { ok: false, error: "Ruta inválida" };
  }
  if (rutaEsObligatoria(modalidad) && ruta_id === null) {
    return { ok: false, error: "La ruta es obligatoria para modalidad fija o por km" };
  }

  const valorNum = Number(raw.valor);
  if (!Number.isFinite(valorNum) || valorNum < 0) {
    return { ok: false, error: "El valor debe ser un número ≥ 0" };
  }
  if (valorNum > MAX_VALOR) {
    return { ok: false, error: `El valor no puede superar ${MAX_VALOR.toLocaleString("es-AR")}` };
  }

  const monedaRaw = typeof raw.moneda === "string" ? raw.moneda.trim().toUpperCase() : "ARS";
  const moneda = monedaRaw.length === 3 ? monedaRaw : "ARS";

  const vigDesde = typeof raw.vigencia_desde === "string" ? raw.vigencia_desde.trim() : "";
  if (!isFecha(vigDesde)) return { ok: false, error: "Fecha de vigencia desde inválida" };

  const vigHastaRaw = typeof raw.vigencia_hasta === "string" ? raw.vigencia_hasta.trim() : "";
  const vigencia_hasta = vigHastaRaw ? vigHastaRaw : null;
  if (vigencia_hasta !== null) {
    if (!isFecha(vigencia_hasta)) return { ok: false, error: "Fecha de vigencia hasta inválida" };
    if (vigencia_hasta <= vigDesde) {
      return { ok: false, error: "La fecha hasta debe ser posterior a la fecha desde" };
    }
  }

  const obsRaw = typeof raw.observaciones === "string" ? raw.observaciones.trim() : "";
  if (obsRaw.length > MAX_OBS) {
    return { ok: false, error: `Las observaciones no pueden superar ${MAX_OBS} caracteres` };
  }
  const observaciones = obsRaw === "" ? null : obsRaw;

  return {
    ok: true,
    data: {
      cliente_id,
      ruta_id,
      modalidad,
      valor: valorNum,
      moneda,
      vigencia_desde: vigDesde,
      vigencia_hasta,
      observaciones,
    },
  };
}
