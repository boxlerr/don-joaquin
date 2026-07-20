import PageHeader from "@/components/layout/PageHeader";
import StatusBadge from "@/components/ui/StatusBadge";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSeccion, hasSeccion } from "@/lib/auth";
import { emailConfigurado } from "@/lib/email";
import {
  type LucideIcon,
  Building2,
  Settings,
  Mail,
  MessageCircle,
  History,
  Database,
  FileText,
  Server,
} from "lucide-react";
import ParametrosList from "./ParametrosList";
import ConfiguracionHelpButton from "./ConfiguracionHelpButton";
import ConfigTabs from "./ConfigTabs";
import EmpresaCard from "./EmpresaCard";
import { EMPRESA_CARD_CLAVES } from "./meta";

type Tone = "success" | "warning" | "neutral";

export default async function ConfiguracionPage() {
  const user = await requireSeccion("configuracion", "read");
  const canWrite = hasSeccion(user, "configuracion", "write");
  const esAdmin = user.rol.codigo === "admin";
  const supabase = createAdminClient();
  const { data: parametros } = await supabase
    .from("parametros_sistema")
    .select("*")
    .order("categoria")
    .order("clave");

  const params = parametros ?? [];
  const valorDe = (clave: string) => params.find((p) => p.clave === clave)?.valor ?? "";
  const empresa = {
    razon_social: valorDe("empresa_razon_social"),
    cuit: valorDe("empresa_cuit"),
    domicilio: valorDe("empresa_domicilio"),
    email: valorDe("empresa_email"),
    telefono: valorDe("empresa_telefono"),
  };

  const emailListo = emailConfigurado();

  const servicios: {
    icon: LucideIcon;
    title: string;
    description: string;
    estado: { label: string; tone: Tone };
  }[] = [
    {
      icon: Mail,
      title: "Correo (SMTP)",
      description: "Servicio transaccional para enviar alertas y resúmenes por email.",
      estado: emailListo
        ? { label: "Activo", tone: "success" }
        : { label: "Falta configurar", tone: "warning" },
    },
    {
      icon: MessageCircle,
      title: "WhatsApp",
      description: "Alertas administrativas: vencimientos, cheques, viáticos sin rendir.",
      estado: { label: "Pendiente", tone: "warning" },
    },
    {
      icon: History,
      title: "Auditoría",
      description: "Registro de altas, bajas y modificaciones — retención mínima 12 meses.",
      estado: { label: "Activo", tone: "success" },
    },
    {
      icon: FileText,
      title: "Documentación",
      description: "Archivos PDF/JPG/PNG asociados a viajes, camiones y choferes.",
      estado: { label: "Activo", tone: "success" },
    },
    {
      icon: Database,
      title: "Respaldos automáticos",
      description: "Backup diario, retención mínima 30 días, restauración bajo demanda.",
      estado: { label: "Activo", tone: "success" },
    },
    {
      icon: Server,
      title: "Autenticación (Supabase)",
      description: "HTTPS, contraseñas cifradas y cierre de sesión por inactividad.",
      estado: { label: "Activo", tone: "success" },
    },
  ];

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Configuración"
        description="Parámetros del sistema y servicios externos"
        action={<ConfiguracionHelpButton />}
      />

      <ConfigTabs />

      <div className="space-y-8 pt-2">
        <section>
          <SectionTitle
            icon={Building2}
            label="Empresa"
            hint="Datos legales y de contacto que usa todo el sistema."
          />
          <EmpresaCard empresa={empresa} moneda={valorDe("moneda_default")} canEdit={esAdmin} />
        </section>

        <section>
          <SectionTitle
            icon={Settings}
            label="Parámetros del sistema"
            hint="Ajustes que cambian el comportamiento del sistema. Cada cambio queda auditado."
          />
          <ParametrosList
            parametros={params}
            canWrite={canWrite}
            hideClaves={EMPRESA_CARD_CLAVES}
          />
        </section>

        <section>
          <SectionTitle
            icon={Database}
            label="Servicios e integraciones"
            hint="Servicios externos de los que depende el sistema y su estado actual."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {servicios.map((s) => (
              <InfoCard key={s.title} {...s} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2">
        <Icon size={16} className="text-primary" />
        <h2 className="text-foreground text-base font-semibold">{label}</h2>
      </div>
      {hint && <p className="text-muted-foreground text-xs mt-1 ml-6">{hint}</p>}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  description,
  estado,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  estado: { label: string; tone: Tone };
}) {
  return (
    <div className="flex items-start gap-3 p-4 bg-card rounded-[10px] border border-border shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#E1F5FE] shrink-0">
        <Icon size={19} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-foreground text-sm font-semibold truncate">{title}</p>
          <StatusBadge label={estado.label} tone={estado.tone} />
        </div>
        <p className="text-muted-foreground text-xs mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}
