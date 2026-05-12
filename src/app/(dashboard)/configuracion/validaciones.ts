import type { Database } from "@/types/database";

type TipoDato = Database["public"]["Enums"]["parametro_tipo_dato"];

export type ValidacionParametro = {
  min?: number;
  max?: number;
  step?: number;
  pattern?: { regex: string; mensaje: string };
  opciones?: string[];
  pista?: string;
};

export const VALIDACIONES_POR_CLAVE: Record<string, ValidacionParametro> = {
  // Tarifas
  tarifa_base: {
    min: 0,
    max: 10_000_000,
    step: 0.01,
    pista: "Entre $0 y $10.000.000",
  },
  precio_por_kg: {
    min: 0,
    max: 10_000,
    step: 0.01,
    pista: "Entre $0 y $10.000",
  },
  precio_por_km: {
    min: 0,
    max: 10_000,
    step: 0.01,
    pista: "Entre $0 y $10.000",
  },
  tarifa_km_default: {
    min: 0,
    max: 10_000,
    step: 0.01,
    pista: "Entre $0 y $10.000",
  },

  // Notificaciones — umbrales de alertas
  dias_alerta_vencimiento_default: {
    min: 1,
    max: 365,
    step: 1,
    pista: "Entre 1 y 365 días",
  },
  dias_alerta_cheque: {
    min: 1,
    max: 365,
    step: 1,
    pista: "Entre 1 y 365 días",
  },
  alerta_critico_dias: {
    min: 1,
    max: 90,
    step: 1,
    pista: "Entre 1 y 90 días — debe ser menor al umbral de anticipación",
  },
  alerta_viatico_pendiente_dias: {
    min: 1,
    max: 90,
    step: 1,
    pista: "Entre 1 y 90 días",
  },
  alerta_viaje_sin_cerrar_horas: {
    min: 1,
    max: 720,
    step: 1,
    pista: "Entre 1 y 720 horas (30 días)",
  },

  // Seguridad
  sesion_inactividad_horas: {
    min: 1,
    max: 168,
    step: 1,
    pista: "Entre 1 y 168 horas (7 días)",
  },
};

export function getValidacion(clave: string, tipo: TipoDato): ValidacionParametro {
  const especifica = VALIDACIONES_POR_CLAVE[clave];
  if (especifica) return especifica;

  if (tipo === "number") {
    return { min: 0, pista: "Debe ser mayor o igual a 0" };
  }
  return {};
}

export function validarRestricciones(
  valor: string,
  tipo: TipoDato,
  validacion: ValidacionParametro,
): { ok: true } | { ok: false; error: string } {
  if (tipo === "number") {
    const num = Number(valor);
    if (validacion.min !== undefined && num < validacion.min) {
      return { ok: false, error: `El valor mínimo permitido es ${validacion.min}` };
    }
    if (validacion.max !== undefined && num > validacion.max) {
      return { ok: false, error: `El valor máximo permitido es ${validacion.max}` };
    }
  }

  if (tipo === "string") {
    if (validacion.opciones && !validacion.opciones.includes(valor)) {
      return {
        ok: false,
        error: `Valor no permitido. Opciones: ${validacion.opciones.join(", ")}`,
      };
    }
    if (validacion.pattern) {
      const regex = new RegExp(validacion.pattern.regex);
      if (!regex.test(valor)) {
        return { ok: false, error: validacion.pattern.mensaje };
      }
    }
  }

  return { ok: true };
}
