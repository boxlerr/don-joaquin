import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Hash,
  Coins,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import EditarEmpresaDialog, { type EmpresaData } from "./negocio/EditarEmpresaDialog";

function formatCuit(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return raw;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/**
 * Ficha con los datos de la empresa. Vive dentro de Configuración → General
 * (antes era una subsección aparte "Negocio"). Los parámetros que muestra se
 * ocultan de la lista de parámetros para no duplicarlos.
 */
export default function EmpresaCard({
  empresa,
  moneda,
  canEdit,
}: {
  empresa: EmpresaData;
  moneda: string;
  canEdit: boolean;
}) {
  const campos: { label: string; icon: LucideIcon; valor: string; ancho: "full" | "half" }[] = [
    { label: "Razón social", icon: Building2, valor: empresa.razon_social, ancho: "half" },
    { label: "CUIT", icon: Hash, valor: empresa.cuit ? formatCuit(empresa.cuit) : "", ancho: "half" },
    { label: "Domicilio", icon: MapPin, valor: empresa.domicilio, ancho: "full" },
    { label: "Email de contacto", icon: Mail, valor: empresa.email, ancho: "half" },
    { label: "Teléfono", icon: Phone, valor: empresa.telefono, ancho: "half" },
  ];

  const completos = campos.filter((c) => c.valor.trim() !== "").length;
  const total = campos.length;
  const todoListo = completos === total;

  return (
    <div className="bg-card rounded-[10px] border border-border shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#E0F2FE] text-[#0369A1] shrink-0">
            <Building2 size={17} />
          </span>
          <div className="min-w-0">
            <h2 className="text-foreground text-sm font-semibold">Datos de la empresa</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Se usan en documentos legales, liquidaciones y comunicaciones.
            </p>
          </div>
        </div>
        {canEdit && <EditarEmpresaDialog initial={empresa} />}
      </div>

      <div
        className={`px-5 py-2.5 flex items-center gap-2 text-xs border-b ${
          todoListo
            ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]"
            : "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]"
        }`}
      >
        <ShieldCheck size={14} className="shrink-0" />
        <span className="font-medium">
          {todoListo
            ? "Todos los datos están completos."
            : `${completos} de ${total} datos completos — falta cargar ${total - completos}.`}
        </span>
      </div>

      <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
        {campos.map((c) => {
          const Icon = c.icon;
          const vacio = c.valor.trim() === "";
          return (
            <div key={c.label} className={c.ancho === "full" ? "sm:col-span-2" : ""}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Icon size={13} className="text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {c.label}
                </span>
              </div>
              {vacio ? (
                <p className="text-sm text-muted-foreground/60 italic">Sin definir</p>
              ) : (
                <p className="text-sm text-foreground font-medium break-words">{c.valor}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-5 py-3 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Coins size={13} />
          Moneda del sistema: <strong className="text-foreground">{moneda || "—"}</strong>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            (solo lectura)
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          Los cambios quedan registrados en auditoría.
        </span>
      </div>
    </div>
  );
}
