export type Severidad = "critica" | "advertencia" | "info";

export type AlertaCategoria = "documentacion" | "cheques" | "viajes" | "personal" | "sistema";

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
  // false para alertas calculadas en vivo desde los documentos: no se "marcan como
  // leídas" (se resuelven actualizando el documento), así que se ocultan ese botón.
  marcable?: boolean;
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
  personal: "Personal",
  sistema: "Sistema",
};

export function categoriaDeAlerta(tipo: string, entidadTipo?: string | null): AlertaCategoria {
  // Ausencias / permisos programados: afectan la planificación operativa de viajes.
  if (tipo === "otro" && entidadTipo === "chofer_ausencia") return "viajes";
  // Alertas de RRHH: cumpleaños, aniversarios y período de prueba (choferes y adm/mant)
  if (
    tipo === "otro" &&
    (entidadTipo === "choferes_cumple" ||
      entidadTipo === "choferes_aniversario" ||
      entidadTipo === "choferes_periodo_prueba" ||
      entidadTipo === "choferes_vacaciones_saldo" ||
      entidadTipo === "personal_cumple" ||
      entidadTipo === "personal_aniversario")
  ) {
    return "personal";
  }
  if (tipo.startsWith("vencimiento_doc_")) return "documentacion";
  if (tipo === "vencimiento_compliance") return "documentacion";
  if (tipo.includes("cheque")) return "cheques";
  if (tipo.includes("viaje") || tipo.includes("viatico")) return "viajes";
  return "sistema";
}

export function alertaHref(alerta: Pick<AlertaItem, "tipo" | "entidad_tipo" | "entidad_id">): string | null {
  // Recordatorio de precios del catálogo → tab Insumos de Mantenimiento.
  if (alerta.tipo === "otro" && alerta.entidad_tipo === "insumo_precio_desactualizado") {
    return "/mantenimiento?tab=insumos";
  }
  // Cuota de préstamo por vencer / vencida, y el aviso de tope mensual
  // superado → módulo de préstamos.
  if (
    alerta.tipo === "otro" &&
    (alerta.entidad_tipo?.startsWith("prestamo_cuota") ||
      alerta.entidad_tipo === "prestamos_tope_mensual")
  ) {
    return "/prestamos";
  }
  // Vencimiento impositivo, de la empresa o personal → el calendario, con la
  // solapa ya puesta en lo que el aviso está reclamando. Hasta el 02/09/2026
  // estos avisos no llevaban a ningún lado: eran los únicos de Finanzas que no
  // se podían abrir desde la campana.
  if (alerta.tipo === "otro" && alerta.entidad_tipo?.startsWith("impuesto")) {
    return alerta.entidad_tipo.endsWith(":vencido")
      ? "/impuestos?estado=vencido"
      : "/impuestos?estado=por_vencer";
  }
  // Ausencia programada → legajo del chofer, tab Ausencias.
  // El tope de gastos lleva a su caja, que es donde se ve la barra y se cambia
  // el número. La chica es la vista por defecto; la general va por la URL.
  if (alerta.tipo === "otro" && alerta.entidad_tipo?.startsWith("caja_tope_mensual")) {
    return alerta.entidad_tipo.endsWith(":grande") ? "/caja?caja=grande" : "/caja";
  }

  if (alerta.tipo === "otro" && alerta.entidad_tipo === "chofer_ausencia" && alerta.entidad_id) {
    return `/choferes/${alerta.entidad_id}?tab=ausencias`;
  }
  // Saldo de vacaciones por vencer → legajo del chofer, tab Vacaciones.
  if (alerta.tipo === "otro" && alerta.entidad_tipo === "choferes_vacaciones_saldo" && alerta.entidad_id) {
    return `/choferes/${alerta.entidad_id}?tab=vacaciones`;
  }
  if (
    alerta.tipo === "otro" &&
    alerta.entidad_tipo &&
    (alerta.entidad_tipo.startsWith("choferes") || alerta.entidad_tipo.startsWith("personal_")) &&
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
      return "/compliance/loma-negra";
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

export function chipToneFromDias(dias: number, esCumple?: boolean, esPrueba?: boolean, esAniversario?: boolean): DiasChipTone {
  if (esCumple) {
    return { bg: "bg-[#F3E8FF]", text: "text-[#6B21A8]", border: "border-[#E9D5FF]" };
  }
  if (esAniversario) {
    return { bg: "bg-[#FFF7ED]", text: "text-[#9A3412]", border: "border-[#FED7AA]" };
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

