export type Severidad = "critica" | "advertencia" | "info";

export type AlertaCategoria = "documentacion" | "cheques" | "viajes" | "sistema";

export type AlertaItem = {
  id: string;
  tipo: string;
  severidad: Severidad;
  titulo: string;
  mensaje: string;
  fecha_disparo: string;
  fecha_vencimiento: string | null;
  entidad_tipo: string | null;
};

export const SEVERIDAD_LABEL: Record<Severidad, string> = {
  critica: "Crítica",
  advertencia: "Advertencia",
  info: "Info",
};

export const SEVERIDAD_TONE: Record<Severidad, "error" | "warning" | "info"> = {
  critica: "error",
  advertencia: "warning",
  info: "info",
};

export const CATEGORIA_LABEL: Record<AlertaCategoria, string> = {
  documentacion: "Documentación",
  cheques: "Cheques",
  viajes: "Viajes y viáticos",
  sistema: "Sistema",
};

export function categoriaDeAlerta(tipo: string): AlertaCategoria {
  if (tipo.startsWith("vencimiento_doc_")) return "documentacion";
  if (tipo.includes("cheque")) return "cheques";
  if (tipo.includes("viaje") || tipo.includes("viatico")) return "viajes";
  return "sistema";
}

export function alertaHref(alerta: Pick<AlertaItem, "tipo" | "entidad_tipo">): string | null {
  switch (alerta.tipo) {
    case "vencimiento_doc_camion":
      return "/camiones";
    case "vencimiento_doc_chofer":
      return "/choferes";
    case "vencimiento_cheque":
    case "cheque_rechazado_recordatorio":
      return "/cheques";
    case "viaje_sin_cerrar":
      return "/viajes";
    default:
      return null;
  }
}

export function diasRestantes(fechaVencimiento: string | null): number | null {
  if (!fechaVencimiento) return null;
  const ms = new Date(fechaVencimiento).getTime() - Date.now();
  return Math.ceil(ms / 86400000);
}

export type DiasChipTone = {
  bg: string;
  text: string;
  border: string;
};

export function chipToneFromDias(dias: number): DiasChipTone {
  if (dias < 0) {
    return { bg: "bg-[#FEE2E2]", text: "text-[#7F1D1D]", border: "border-[#FCA5A5]" };
  }
  if (dias <= 7) {
    return { bg: "bg-[#FEF2F2]", text: "text-[#991B1B]", border: "border-[#FECACA]" };
  }
  if (dias <= 15) {
    return { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", border: "border-[#FDE68A]" };
  }
  return { bg: "bg-[#ECFDF5]", text: "text-[#065F46]", border: "border-[#A7F3D0]" };
}

export function chipLabelFromDias(dias: number): string {
  if (dias < 0) return `Vencido ${Math.abs(dias)}d`;
  if (dias === 0) return "Vence hoy";
  return `${dias}d`;
}
