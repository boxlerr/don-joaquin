import PageHeader from "@/components/layout/PageHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type LucideIcon,
  Settings,
  Building2,
  Mail,
  MessageCircle,
  Shield,
  History,
  Database,
  FileText,
  Bell,
  Wallet,
} from "lucide-react";

const CATEGORY_META: Record<string, { icon: LucideIcon; titulo: string }> = {
  general: { icon: Building2, titulo: "Empresa y datos generales" },
  notificaciones: { icon: Bell, titulo: "Notificaciones" },
  seguridad: { icon: Shield, titulo: "Seguridad" },
  liquidacion: { icon: Wallet, titulo: "Liquidación" },
};

const CATEGORY_ORDER = ["general", "notificaciones", "seguridad", "liquidacion"];

function formatValor(valor: string, tipo: string): string {
  if (valor === "") return "—";
  if (tipo === "boolean") return valor === "true" ? "Activado" : "Desactivado";
  return valor;
}

export default async function ConfiguracionPage() {
  const supabase = createAdminClient();
  const { data: parametros } = await supabase
    .from("parametros_sistema")
    .select("*")
    .order("categoria")
    .order("clave");

  const grouped = (parametros ?? []).reduce<
    Record<string, NonNullable<typeof parametros>>
  >((acc, p) => {
    const cat = p.categoria ?? "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat]!.push(p);
    return acc;
  }, {});

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="Configuración"
        description="Parámetros del sistema y servicios externos"
      />

      <div>
        <SectionTitle icon={Settings} label="Parámetros del sistema" />
        {CATEGORY_ORDER.filter((cat) => grouped[cat]?.length).map((cat) => {
          const meta = CATEGORY_META[cat] ?? CATEGORY_META.general;
          const Icon = meta.icon;
          return (
            <div key={cat} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className="text-[#475569]" />
                <h3 className="text-[10px] font-semibold uppercase tracking-widest text-[#475569]">
                  {meta.titulo}
                </h3>
              </div>
              <div className="bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm divide-y divide-[#E2E8F0]">
                {grouped[cat]!.map((p) => (
                  <div key={p.id} className="flex items-start gap-4 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#0F172A] text-sm font-medium">
                        {p.descripcion ?? p.clave}
                      </p>
                      <p className="text-[#94A3B8] text-xs mt-0.5 font-mono">{p.clave}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[#0F172A] text-sm font-semibold">
                        {formatValor(p.valor, p.tipo_dato)}
                      </p>
                      {!p.editable && (
                        <span className="inline-block mt-1 text-[10px] text-[#94A3B8] uppercase tracking-wide">
                          Solo lectura
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <SectionTitle icon={Database} label="Servicios e integraciones" />
        <div className="grid grid-cols-2 gap-4">
          <InfoCard
            icon={Mail}
            title="Resend (correo)"
            description="Servicio transaccional con verificación de dominio + SPF/DKIM/DMARC"
          />
          <InfoCard
            icon={MessageCircle}
            title="WhatsApp"
            description="Alertas administrativas: vencimientos, cheques, viáticos sin rendir"
          />
          <InfoCard
            icon={History}
            title="Auditoría"
            description="Log de altas, bajas y modificaciones — retención mínima 12 meses"
          />
          <InfoCard
            icon={FileText}
            title="Documentación"
            description="Tipos PDF/JPG/PNG asociados a viajes, camiones y choferes"
          />
          <InfoCard
            icon={Database}
            title="Respaldos automáticos"
            description="Backup diario, retención mínima 30 días, restauración bajo demanda"
          />
          <InfoCard
            icon={Settings}
            title="Auth Supabase"
            description="HTTPS, bcrypt, sesiones con expiración por inactividad"
          />
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={16} className="text-[#0088D1]" />
      <h2 className="text-[#0F172A] text-base font-semibold">{label}</h2>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 p-4 bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E1F5FE] shrink-0">
        <Icon size={18} className="text-[#0088D1]" />
      </div>
      <div className="min-w-0">
        <p className="text-[#0F172A] text-sm font-semibold">{title}</p>
        <p className="text-[#475569] text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
}
