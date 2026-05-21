import PageHeader from "@/components/layout/PageHeader";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { Building2, Mail, Phone, MapPin, Hash } from "lucide-react";
import EditarEmpresaDialog, { type EmpresaData } from "./EditarEmpresaDialog";

const READ_ONLY_INPUT =
  "w-full px-3 py-2 text-sm border border-border rounded-md bg-muted/40 text-foreground placeholder-[#94A3B8] focus:outline-none";

const EMPRESA_KEYS = [
  "empresa_razon_social",
  "empresa_cuit",
  "empresa_domicilio",
  "empresa_email",
  "empresa_telefono",
] as const;

export default async function ConfiguracionNegocioPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const { data: parametros } = await supabase
    .from("parametros_sistema")
    .select("clave, valor")
    .in("clave", EMPRESA_KEYS);

  const valores = new Map((parametros ?? []).map((p) => [p.clave, p.valor]));

  const empresa: EmpresaData = {
    razon_social: valores.get("empresa_razon_social") ?? "",
    cuit: valores.get("empresa_cuit") ?? "",
    domicilio: valores.get("empresa_domicilio") ?? "",
    email: valores.get("empresa_email") ?? "",
    telefono: valores.get("empresa_telefono") ?? "",
  };

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        title="Configuración de Negocio"
        description="Datos de la empresa, contacto e información legal"
      />

      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">Datos de la Empresa</h2>
          </div>
          <EditarEmpresaDialog initial={empresa} />
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-[#1E293B] block mb-2">
                Razón Social
              </label>
              <input
                type="text"
                value={empresa.razon_social}
                placeholder="Sin definir"
                className={READ_ONLY_INPUT}
                disabled
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#1E293B] mb-2 flex items-center gap-2">
                <Hash size={14} />
                CUIT
              </label>
              <input
                type="text"
                value={empresa.cuit}
                placeholder="Sin definir"
                className={READ_ONLY_INPUT}
                disabled
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#1E293B] mb-2 flex items-center gap-2">
              <MapPin size={14} />
              Domicilio
            </label>
            <input
              type="text"
              value={empresa.domicilio}
              placeholder="Sin definir"
              className={READ_ONLY_INPUT}
              disabled
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-[#1E293B] mb-2 flex items-center gap-2">
                <Mail size={14} />
                Email de contacto
              </label>
              <input
                type="email"
                value={empresa.email}
                placeholder="Sin definir"
                className={READ_ONLY_INPUT}
                disabled
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#1E293B] mb-2 flex items-center gap-2">
                <Phone size={14} />
                Teléfono
              </label>
              <input
                type="tel"
                value={empresa.telefono}
                placeholder="Sin definir"
                className={READ_ONLY_INPUT}
                disabled
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground pt-4 border-t border-border">
            Los cambios quedan registrados en el historial de auditoría.
          </p>
        </div>
      </div>
    </div>
  );
}
