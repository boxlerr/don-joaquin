import PageHeader from "@/components/layout/PageHeader";
import { type LucideIcon, Settings, Building2, Bell, Shield, Database } from "lucide-react";

interface ConfigSectionProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function ConfigSection({ icon: Icon, title, description }: ConfigSectionProps) {
  return (
    <button
      type="button"
      className="flex items-start gap-4 p-5 w-full text-left bg-white rounded-[8px] border border-[#E2E8F0] shadow-sm hover:border-[#0088D1]/30 transition-colors"
    >
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#E1F5FE] shrink-0">
        <Icon size={20} className="text-[#0088D1]" />
      </div>
      <div>
        <p className="text-[#0F172A] text-sm font-semibold mb-0.5">{title}</p>
        <p className="text-[#475569] text-xs">{description}</p>
      </div>
    </button>
  );
}

export default function ConfiguracionPage() {
  return (
    <div className="p-8">
      <PageHeader
        title="Configuración"
        description="Parámetros y ajustes del sistema"
      />

      <div className="grid grid-cols-2 gap-4">
        <ConfigSection
          icon={Building2}
          title="Datos de la empresa"
          description="Razón social, CUIT, domicilio y datos fiscales"
        />
        <ConfigSection
          icon={Bell}
          title="Notificaciones"
          description="Configurar alertas, correos y avisos automáticos"
        />
        <ConfigSection
          icon={Shield}
          title="Seguridad y accesos"
          description="Políticas de contraseñas, 2FA y permisos por rol"
        />
        <ConfigSection
          icon={Database}
          title="Respaldos y datos"
          description="Exportación, importación y backup de información"
        />
        <ConfigSection
          icon={Settings}
          title="Parámetros generales"
          description="Moneda, zona horaria y preferencias del sistema"
        />
      </div>
    </div>
  );
}
