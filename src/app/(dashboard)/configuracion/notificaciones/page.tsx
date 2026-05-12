import PageHeader from "@/components/layout/PageHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Bell, Users } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import CanalCard from "./CanalCard";
import AlertaToggle from "./AlertaToggle";
import DestinatarioToggle from "./DestinatarioToggle";
import { ALERTAS, CANALES, DESTINATARIOS_CLAVE, alertaClave } from "./constants";

function parseDestinatarios(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export default async function ConfiguracionNotificacionesPage() {
  await requireAdmin();

  const supabase = createAdminClient();

  const clavesParametros = [
    ...CANALES.map((c) => c.activoClave),
    ...CANALES.flatMap((c) => c.configCampos.map((f) => f.clave)),
    ...ALERTAS.map((a) => alertaClave(a.key)),
    DESTINATARIOS_CLAVE,
  ];

  const [{ data: parametros }, { data: usuarios }] = await Promise.all([
    supabase.from("parametros_sistema").select("clave, valor").in("clave", clavesParametros),
    supabase
      .from("usuarios")
      .select("id, nombre, apellido, email, estado, rol:roles!rol_id (nombre, codigo)")
      .eq("estado", "activo")
      .order("nombre"),
  ]);

  const valores = new Map((parametros ?? []).map((p) => [p.clave, p.valor]));
  const destinatariosIds = new Set(parseDestinatarios(valores.get(DESTINATARIOS_CLAVE)));

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="Configuración de Notificaciones"
        description="Canales, alertas y preferencias de comunicación"
      />

      <div>
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-[#0088D1]" />
          <h2 className="text-[#0F172A] text-sm font-semibold">Canales de Notificación</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {CANALES.map((canal) => {
            const activo = valores.get(canal.activoClave) === "true";
            const configValores: Record<string, string> = {};
            for (const campo of canal.configCampos) {
              configValores[campo.clave] = valores.get(campo.clave) ?? "";
            }
            return (
              <CanalCard
                key={canal.key}
                canal={canal}
                activo={activo}
                configValores={configValores}
              />
            );
          })}
        </div>
      </div>

      <div className="pt-6 border-t border-[#E2E8F0]">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-[#0088D1]" />
          <h2 className="text-[#0F172A] text-sm font-semibold">Tipos de Alertas</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {ALERTAS.map((alerta) => (
            <AlertaToggle
              key={alerta.key}
              alertaKey={alerta.key}
              nombre={alerta.nombre}
              descripcion={alerta.descripcion}
              initialActivo={valores.get(alertaClave(alerta.key)) === "true"}
            />
          ))}
        </div>
      </div>

      <div className="pt-6 border-t border-[#E2E8F0]">
        <div className="flex items-center gap-2 mb-4">
          <Users size={16} className="text-[#0088D1]" />
          <h2 className="text-[#0F172A] text-sm font-semibold">Destinatarios de Alertas</h2>
        </div>

        {(usuarios ?? []).length === 0 ? (
          <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm p-6 text-center">
            <p className="text-sm text-[#475569]">No hay usuarios activos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(usuarios ?? []).map((u) => {
              const rol = Array.isArray(u.rol) ? u.rol[0] : u.rol;
              const activo = destinatariosIds.has(u.id);
              const nombreCompleto = [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email;
              return (
                <div
                  key={u.id}
                  className="p-4 bg-white rounded-[8px] border border-[#E2E8F0] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#0F172A] truncate">{nombreCompleto}</p>
                    <p className="text-xs text-[#64748B] truncate">
                      {u.email}
                      {rol?.nombre ? ` • ${rol.nombre}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge
                      label={activo ? "Recibe alertas" : "Sin alertas"}
                      tone={activo ? "success" : "neutral"}
                    />
                    <DestinatarioToggle usuarioId={u.id} initialActivo={activo} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
