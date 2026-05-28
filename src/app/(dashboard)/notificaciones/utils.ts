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
  entidad_id: string | null;
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
  if (tipo === "vencimiento_compliance") return "documentacion";
  if (tipo.includes("cheque")) return "cheques";
  if (tipo.includes("viaje") || tipo.includes("viatico")) return "viajes";
  return "sistema";
}

export function alertaHref(alerta: Pick<AlertaItem, "tipo" | "entidad_tipo" | "entidad_id">): string | null {
  if (
    alerta.tipo === "otro" &&
    alerta.entidad_tipo &&
    alerta.entidad_tipo.startsWith("choferes") &&
    alerta.entidad_id
  ) {
    return `/choferes/${alerta.entidad_id}`;
  }
  switch (alerta.tipo) {
    case "vencimiento_doc_camion":
      return alerta.entidad_id ? `/camiones?documentoId=${alerta.entidad_id}` : "/camiones";
    case "vencimiento_doc_chofer":
      return alerta.entidad_id ? `/choferes?documentoId=${alerta.entidad_id}` : "/choferes";
    case "vencimiento_compliance":
      return "/compliance/proximas";
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
  const parts = fechaVencimiento.split("-");
  let targetDate: Date;
  if (parts.length === 3) {
    targetDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  } else {
    targetDate = new Date(fechaVencimiento);
  }

  const hoy = new Date();
  const hoyMidnight = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const ms = targetMidnight.getTime() - hoyMidnight.getTime();
  return Math.round(ms / 86400000);
}

export type DiasChipTone = {
  bg: string;
  text: string;
  border: string;
};

export function chipToneFromDias(dias: number, esCumple?: boolean, esPrueba?: boolean): DiasChipTone {
  if (esCumple) {
    return { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", border: "border-[#E9D5FF]" };
  }
  if (esPrueba) {
    if (dias <= 5) {
      return { bg: "bg-[#FEF2F2]", text: "text-[#991B1B]", border: "border-[#FECACA]" };
    }
    if (dias <= 15) {
      return { bg: "bg-[#FFFBEB]", text: "text-[#92400E]", border: "border-[#FDE68A]" };
    }
    return { bg: "bg-[#F0F9FF]", text: "text-[#075985]", border: "border-[#B3E5FC]" };
  }
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
