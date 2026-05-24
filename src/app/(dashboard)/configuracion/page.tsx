import PageHeader from "@/components/layout/PageHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireArea } from "@/lib/auth";
import {
  type LucideIcon,
  Settings,
  Mail,
  MessageCircle,
  History,
  Database,
  FileText,
} from "lucide-react";
import ParametrosList from "./ParametrosList";

export default async function ConfiguracionPage() {
  await requireArea("sistema", "read");
  const supabase = createAdminClient();
  const { data: parametros } = await supabase
    .from("parametros_sistema")
    .select("*")
    .order("categoria")
    .order("clave");

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        title="Configuración"
        description="Parámetros del sistema y servicios externos"
      />

      <div>
        <SectionTitle icon={Settings} label="Parámetros del sistema" />
        <ParametrosList parametros={parametros ?? []} />
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
      <Icon size={16} className="text-primary" />
      <h2 className="text-foreground text-base font-semibold">{label}</h2>
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
    <div className="flex items-start gap-3 p-4 bg-card rounded-[8px] border border-border shadow-sm">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E1F5FE] shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        <p className="text-muted-foreground text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
}
