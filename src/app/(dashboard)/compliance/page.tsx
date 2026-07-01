import { requireArea, hasArea, hasSeccion } from "@/lib/auth";
import { getComplianceEstadoAction } from "./actions";
import { getOrganismosAction, getOrganismoChecklistAction } from "./organismos/actions";
import { getForm931Action } from "./form-931/actions";
import type { ComplianceEstado, ComplianceEstadoRow, ComplianceResumenRow } from "./types";
import ComplianceResumenClient, { type AccesoDirecto } from "./ComplianceResumenClient";

/**
 * Panel unificado de Compliance (`/compliance`).
 *
 * Reúne en una sola pantalla, tipo checklist, TODO lo que hay que presentar y su
 * vencimiento: Formulario 931, YPF, Loma Negra y organismos (SICOP, Secondi…).
 * Es de solo lectura y agregador: normaliza las 3 fuentes de datos ya existentes y
 * deja que cada fila abra su sección de detalle para cargar/editar. Cubre el rol de
 * Noelia (ver de un vistazo qué vence) sin duplicar la lógica de carga.
 */

function diasHasta(fechaISO: string): number {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const venc = new Date(y!, m! - 1, d!);
  const hoy = new Date();
  const hoyMid = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  return Math.round((venc.getTime() - hoyMid.getTime()) / 86400000);
}

function fmtPeriodo(p: string): string {
  const m = p.match(/^(\d{4})-(\d{2})$/);
  return m ? `${m[2]}/${m[1]}` : p;
}

export default async function ComplianceResumenPage() {
  const user = await requireArea("compliance", "read");

  const canYpf = hasSeccion(user, "compliance_ypf", "read");
  const canLoma = hasSeccion(user, "compliance_loma", "read");
  const canSicop = hasSeccion(user, "compliance_sicop", "read");
  const canSecondi = hasSeccion(user, "compliance_secondi", "read");
  const canF931 = hasArea(user, "compliance", "read");

  const [ypfData, lomaData, organismos, f931] = await Promise.all([
    canYpf ? getComplianceEstadoAction("YPF") : Promise.resolve(null),
    canLoma ? getComplianceEstadoAction("LOMA_NEGRA") : Promise.resolve(null),
    getOrganismosAction(),
    canF931 ? getForm931Action() : Promise.resolve([]),
  ]);

  const rows: ComplianceResumenRow[] = [];
  const accesos: AccesoDirecto[] = [];

  // ── Formulario 931 (solo períodos pendientes) ────────────────────────────
  if (canF931) {
    accesos.push({ label: "Formulario 931", href: "/compliance/form-931", fuente: "F931" });
    for (const p of f931) {
      if (p.enviado_ypf && p.enviado_loma) continue; // completo → ya no es pendiente
      const dias = diasHasta(p.fecha_limite);
      const estado: ComplianceEstado = dias < 0 ? "vencido" : dias <= 7 ? "por_vencer" : "vigente";
      rows.push({
        id: `f931:${p.id}`,
        fuente: "F931",
        requisito: `Formulario 931 · ${fmtPeriodo(p.periodo)}`,
        entidad: `YPF ${p.enviado_ypf ? "✓" : "✗"} · Loma ${p.enviado_loma ? "✓" : "✗"}`,
        fecha_vencimiento: p.fecha_limite,
        estado,
        dias_restantes: dias,
        observaciones: p.observaciones,
        href: "/compliance/form-931",
      });
    }
  }

  // ── YPF + Loma Negra (dedup de requisitos "AMBOS", que vienen en ambas) ───
  const vistas = new Set<string>();
  const pushCliente = (data: { rows: ComplianceEstadoRow[] } | null, href: string) => {
    if (!data) return;
    for (const r of data.rows) {
      const key = `${r.requisito_id}:${r.chofer_id ?? ""}:${r.camion_id ?? ""}`;
      if (vistas.has(key)) continue;
      vistas.add(key);
      const fuente =
        r.cliente_aplica === "AMBOS" ? "Ambos" : r.cliente_aplica === "YPF" ? "YPF" : "Loma Negra";
      rows.push({
        id: `cli:${key}`,
        fuente,
        requisito: r.requisito_nombre,
        entidad: r.chofer_nombre ?? r.camion_patente ?? "Empresa",
        fecha_vencimiento: r.fecha_vencimiento,
        estado: r.estado,
        dias_restantes: r.dias_restantes,
        observaciones: r.observaciones ?? null,
        href,
      });
    }
  };
  if (canYpf) accesos.push({ label: "YPF", href: "/compliance/ypf", fuente: "YPF" });
  if (canLoma) accesos.push({ label: "Loma Negra", href: "/compliance/loma-negra", fuente: "Loma Negra" });
  pushCliente(ypfData, "/compliance/ypf");
  pushCliente(lomaData, "/compliance/loma-negra");

  // ── Organismos previos (SICOP, Secondi, otros) ───────────────────────────
  const organismosVisibles = organismos.filter((o) => {
    const codigo = o.codigo.toLowerCase();
    if (codigo === "sicop") return canSicop;
    if (codigo === "secondi") return canSecondi;
    return true; // otros organismos: alcanza con el área compliance (ya validada)
  });
  const checklists = await Promise.all(
    organismosVisibles.map(async (o) => ({ o, data: await getOrganismoChecklistAction(o.id) })),
  );
  for (const { o, data } of checklists) {
    const href = `/compliance/organismos/${o.codigo.toLowerCase()}`;
    accesos.push({ label: o.nombre, href, fuente: o.nombre });
    for (const r of data.rows) {
      rows.push({
        id: `org:${o.id}:${r.requisito_id}`,
        fuente: o.nombre,
        requisito: r.requisito_nombre,
        entidad: "—",
        fecha_vencimiento: r.fecha_vencimiento,
        estado: r.estado,
        dias_restantes: r.dias_restantes,
        observaciones: r.observaciones,
        href,
      });
    }
  }

  return <ComplianceResumenClient rows={rows} accesos={accesos} />;
}
