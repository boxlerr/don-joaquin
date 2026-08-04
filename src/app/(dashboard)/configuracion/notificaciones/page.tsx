import PageHeader from "@/components/layout/PageHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { emailConfigurado } from "@/lib/email";
import {
  Bell,
  BellRing,
  Users,
  AlertTriangle,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import ConfigTabs from "../ConfigTabs";
import CanalCard from "./CanalCard";
import AlertaToggle from "./AlertaToggle";
import DestinatarioMatriz from "./DestinatarioMatriz";
import TestNotificacionButton from "./TestNotificacionButton";
import {
  ALERTAS,
  ALERTA_COLUMNAS,
  CANALES,
  DESTINATARIOS_CLAVE,
  MATRIZ_CLAVE,
  alertaClave,
} from "./constants";

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

function parseMatriz(raw: string | null | undefined): Record<string, string[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const TODAS_LAS_COLUMNAS = ALERTA_COLUMNAS.map((c) => c.key);

export default async function ConfiguracionNotificacionesPage() {
  await requireAdmin();

  const supabase = createAdminClient();

  const clavesParametros = [
    ...CANALES.map((c) => c.activoClave),
    ...CANALES.flatMap((c) => c.configCampos.map((f) => f.clave)),
    ...ALERTAS.map((a) => alertaClave(a.key)),
    DESTINATARIOS_CLAVE,
    MATRIZ_CLAVE,
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
  const matriz = parseMatriz(valores.get(MATRIZ_CLAVE));
  const emailListo = emailConfigurado();

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <PageHeader
        title="Configuración de Notificaciones"
        description="Canales, alertas y preferencias de comunicación"
        action={<TestNotificacionButton />}
      />

      <ConfigTabs />

      <div className="pt-2">
        <SectionHeader
          icon={Bell}
          title="Canales de notificación"
          descripcion="Por dónde salen los avisos automáticos del sistema."
        />

        {emailListo ? (
          <div className="mb-4 p-4 rounded-[8px] border border-[#A7F3D0] bg-[#ECFDF5] flex items-start gap-3">
            <CheckCircle2 size={16} className="text-[#059669] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#065F46]">
                Email configurado y listo para enviar
              </p>
              <p className="text-xs text-[#065F46] mt-0.5 leading-relaxed">
                Las credenciales SMTP están cargadas. Para que lleguen los avisos por
                correo asegurate de: (1) activar el canal <strong>Email</strong> acá
                abajo, (2) elegir qué tipos de alerta se envían, y (3) marcar al menos un
                destinatario. Las <strong>alertas críticas</strong> se envían al instante;
                el <strong>resumen diario</strong> sale una vez por día.
                WhatsApp y Webhooks siguen pendientes.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-4 p-4 rounded-[8px] border border-[#FDE68A] bg-[#FFFBEB] flex items-start gap-3">
            <AlertTriangle size={16} className="text-[#B45309] mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#92400E]">
                Falta cargar las credenciales de correo (SMTP)
              </p>
              <p className="text-xs text-[#92400E] mt-0.5 leading-relaxed">
                El envío por email ya está implementado, pero todavía no hay credenciales.
                Cargá <strong>SMTP_USER</strong> y <strong>SMTP_PASS</strong> (contraseña
                de aplicación de Gmail) en las variables de entorno —localmente en{" "}
                <code>.env.local</code> y en Vercel— y volvé a desplegar. Mientras tanto las
                alertas se ven dentro del sistema (en /notificaciones y la campanita).
                WhatsApp y Webhooks siguen pendientes.
              </p>
            </div>
          </div>
        )}

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

      <div className="pt-6 border-t border-border">
        <SectionHeader
          icon={BellRing}
          title="Tipos de alertas"
          descripcion="Qué eventos disparan un aviso. Desactivá los que no quieras recibir."
        />

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

      <div className="pt-6 border-t border-border">
        <SectionHeader
          icon={Users}
          title="Avisos por usuario"
          descripcion="Elegí qué tipo de aviso recibe cada persona. Ej.: los cheques a Pablo, Nico y Barbie; las vacaciones solo a logística. Aplica al email (la campana muestra todo)."
        />

        {(usuarios ?? []).length === 0 ? (
          <div className="bg-card rounded-[8px] border border-border shadow-sm p-6 text-center">
            <p className="text-sm text-muted-foreground">No hay usuarios activos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(usuarios ?? []).map((u) => {
              const rol = Array.isArray(u.rol) ? u.rol[0] : u.rol;
              const nombreCompleto = [u.nombre, u.apellido].filter(Boolean).join(" ") || u.email;
              // Default retrocompatible: si todavía no se configuró la matriz para este
              // usuario, hereda lo viejo (si era destinatario global → recibe todo).
              const enabledInicial =
                matriz[u.id] ?? (destinatariosIds.has(u.id) ? TODAS_LAS_COLUMNAS : []);
              return (
                <DestinatarioMatriz
                  key={u.id}
                  usuarioId={u.id}
                  nombre={nombreCompleto}
                  email={u.email ?? ""}
                  rol={rol?.nombre ?? null}
                  columnas={ALERTA_COLUMNAS}
                  enabledInicial={enabledInicial}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  descripcion,
}: {
  icon: LucideIcon;
  title: string;
  descripcion: string;
}) {
  return (
    <div className="flex items-start gap-2.5 mb-4">
      <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#E1F5FE] text-primary shrink-0">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{descripcion}</p>
      </div>
    </div>
  );
}
