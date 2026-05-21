import { Truck, User, ShieldAlert, Info } from "lucide-react";
import { chipToneFromDias } from "./utils";

type Tipo = {
  id: string;
  nombre: string;
  aplica_a: "camion" | "chofer";
  dias_alerta_vencimiento: number;
  obligatorio: boolean;
};

type DocCount = {
  total: number;
  proximos: number;
  vencidos: number;
};

export default function TiposMonitoreados({
  tipos,
  conteos,
}: {
  tipos: Tipo[];
  conteos: Record<string, DocCount>;
}) {
  const camiones = tipos.filter((t) => t.aplica_a === "camion");
  const choferes = tipos.filter((t) => t.aplica_a === "chofer");

  const totalProximos = Object.values(conteos).reduce((a, c) => a + c.proximos, 0);
  const totalVencidos = Object.values(conteos).reduce((a, c) => a + c.vencidos, 0);

  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-primary" />
            <h2 className="text-foreground text-sm font-semibold">
              Tipos de documento monitoreados
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {totalVencidos > 0 && (
              <span className="px-2 py-0.5 rounded-md border border-[#FECACA] bg-[#FEF2F2] text-[#991B1B] font-semibold">
                {totalVencidos} vencido{totalVencidos !== 1 ? "s" : ""}
              </span>
            )}
            {totalProximos > 0 && (
              <span className="px-2 py-0.5 rounded-md border border-[#FDE68A] bg-[#FFFBEB] text-[#92400E] font-semibold">
                {totalProximos} próximo{totalProximos !== 1 ? "s" : ""} a vencer
              </span>
            )}
            <span className="text-muted-foreground/70">{tipos.length} tipos activos</span>
          </div>
        </div>
        <div className="mt-2.5 flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
          <Info size={13} className="mt-0.5 shrink-0 text-muted-foreground/70" />
          <span>
            Estos son los documentos que el sistema vigila. Cuando uno se acerca
            a su fecha de vencimiento (según los días configurados de cada tipo),
            se genera automáticamente una alerta en esta página. Para editar los
            tipos, agregar otros nuevos o cambiar la anticipación, andá a{" "}
            <span className="font-medium text-muted-foreground">Configuración</span>.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        <TipoColumna
          titulo="Camiones"
          icon={Truck}
          tipos={camiones}
          conteos={conteos}
          accent="info"
        />
        <TipoColumna
          titulo="Choferes"
          icon={User}
          tipos={choferes}
          conteos={conteos}
          accent="warning"
          borderLeft
        />
      </div>
    </div>
  );
}

function TipoColumna({
  titulo,
  icon: Icon,
  tipos,
  conteos,
  accent,
  borderLeft,
}: {
  titulo: string;
  icon: typeof Truck;
  tipos: Tipo[];
  conteos: Record<string, DocCount>;
  accent: "info" | "warning";
  borderLeft?: boolean;
}) {
  const accentColors =
    accent === "info"
      ? { bg: "bg-[#E1F5FE]", text: "text-primary" }
      : { bg: "bg-[#FEF3C7]", text: "text-[#B45309]" };

  const sorted = [...tipos].sort((a, b) => {
    const ca = conteos[a.id] ?? { total: 0, proximos: 0, vencidos: 0 };
    const cb = conteos[b.id] ?? { total: 0, proximos: 0, vencidos: 0 };
    const urgenciaA = ca.vencidos * 1000 + ca.proximos;
    const urgenciaB = cb.vencidos * 1000 + cb.proximos;
    if (urgenciaA !== urgenciaB) return urgenciaB - urgenciaA;
    if (a.obligatorio !== b.obligatorio) return a.obligatorio ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });

  return (
    <div className={borderLeft ? "md:border-l border-border" : ""}>
      <div className="flex items-center gap-2 px-5 py-3 border-b border-[#F1F5F9] bg-[#FAFBFC]">
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentColors.bg}`}
        >
          <Icon size={14} className={accentColors.text} />
        </div>
        <p className="text-sm font-semibold text-foreground">{titulo}</p>
        <span className="text-xs text-muted-foreground/70">· {tipos.length}</span>
      </div>

      {sorted.length === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground/70">
          Sin tipos configurados
        </div>
      ) : (
        <div className="divide-y divide-[#F1F5F9]">
          {sorted.map((t) => {
            const c = conteos[t.id] ?? { total: 0, proximos: 0, vencidos: 0 };
            return <TipoFila key={t.id} tipo={t} conteo={c} />;
          })}
        </div>
      )}
    </div>
  );
}

function TipoFila({ tipo, conteo }: { tipo: Tipo; conteo: DocCount }) {
  const tieneAlertas = conteo.vencidos > 0 || conteo.proximos > 0;

  return (
    <div className="px-5 py-3 hover:bg-muted/40 transition-colors">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate">
              {tipo.nombre}
            </p>
            {tipo.obligatorio && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[#FEF2F2] text-[#991B1B] border border-[#FECACA]">
                Obligatorio
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Avisa con <span className="font-semibold">{tipo.dias_alerta_vencimiento} días</span> de
            anticipación
            <span className="text-[#CBD5E1] mx-1.5">·</span>
            <span>
              {conteo.total} documento{conteo.total !== 1 ? "s" : ""} cargado
              {conteo.total !== 1 ? "s" : ""}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {conteo.vencidos > 0 && (
            <ConteoChip n={conteo.vencidos} label="vencido" tone="vencido" />
          )}
          {conteo.proximos > 0 && (
            <ConteoChip n={conteo.proximos} label="próximo" tone="proximo" />
          )}
          {!tieneAlertas && conteo.total > 0 && (
            <span className="text-[11px] text-[#22C55E] font-medium">Al día</span>
          )}
          {conteo.total === 0 && (
            <span className="text-[11px] text-[#CBD5E1] font-medium">Sin cargas</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConteoChip({
  n,
  label,
  tone,
}: {
  n: number;
  label: string;
  tone: "vencido" | "proximo";
}) {
  const cls =
    tone === "vencido"
      ? chipToneFromDias(-1)
      : chipToneFromDias(5);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-bold ${cls.bg} ${cls.text} ${cls.border}`}
      title={`${n} documento${n !== 1 ? "s" : ""} ${label}${n !== 1 ? "s" : ""}`}
    >
      {n} {label}
      {n !== 1 ? "s" : ""}
    </span>
  );
}
