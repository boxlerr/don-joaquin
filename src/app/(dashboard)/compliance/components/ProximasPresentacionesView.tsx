"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Clock, ShieldCheck, Search, X } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  CLIENTE_LABEL,
  NIVEL_LABEL,
  type ComplianceCliente,
  type ComplianceEstadoRow,
  type ComplianceNivel,
} from "../types";
import { formatFecha } from "@/lib/utils";

interface Props {
  rows: ComplianceEstadoRow[];
}

type ClienteFiltro = "TODOS" | ComplianceCliente;
type NivelFiltro = "TODOS" | ComplianceNivel;

export default function ProximasPresentacionesView({ rows }: Props) {
  const [cliente, setCliente] = useState<ClienteFiltro>("TODOS");
  const [nivel, setNivel] = useState<NivelFiltro>("TODOS");
  const [busqueda, setBusqueda] = useState("");

  const hayFiltros = cliente !== "TODOS" || nivel !== "TODOS" || busqueda.length > 0;
  const limpiar = () => {
    setCliente("TODOS");
    setNivel("TODOS");
    setBusqueda("");
  };

  // Expandimos las filas que aplican a "AMBOS" en dos entries (una por cliente)
  // y luego filtramos.
  const grouped = useMemo(() => {
    const map = new Map<ComplianceCliente, ComplianceEstadoRow[]>();
    const q = busqueda.trim().toLowerCase();

    for (const r of rows) {
      if (nivel !== "TODOS" && r.nivel !== nivel) continue;
      if (q) {
        const text = `${r.chofer_nombre ?? ""} ${r.camion_patente ?? ""} ${r.requisito_nombre}`.toLowerCase();
        if (!text.includes(q)) continue;
      }
      const aplicaA: ComplianceCliente[] =
        r.cliente_aplica === "AMBOS" ? ["YPF", "LOMA_NEGRA"] : [r.cliente_aplica];
      for (const c of aplicaA) {
        if (cliente !== "TODOS" && c !== cliente) continue;
        if (!map.has(c)) map.set(c, []);
        map.get(c)!.push(r);
      }
    }
    return map;
  }, [rows, cliente, nivel, busqueda]);

  const total = useMemo(() => {
    let n = 0;
    for (const arr of grouped.values()) n += arr.length;
    return n;
  }, [grouped]);

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Próximas presentaciones</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Documentos por vencer o vencidos, agrupados por cliente.
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="Buscar chofer, patente o documento..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>

        <ChipGroup
          label="Cliente"
          value={cliente}
          options={[
            { value: "TODOS", label: "Todos" },
            { value: "LOMA_NEGRA", label: "Loma Negra" },
            { value: "YPF", label: "YPF" },
          ]}
          onChange={(v) => setCliente(v as ClienteFiltro)}
        />
        <ChipGroup
          label="Nivel"
          value={nivel}
          options={[
            { value: "TODOS", label: "Todos" },
            { value: "chofer", label: NIVEL_LABEL.chofer },
            { value: "unidad", label: NIVEL_LABEL.unidad },
            { value: "empresa", label: NIVEL_LABEL.empresa },
          ]}
          onChange={(v) => setNivel(v as NivelFiltro)}
        />

        {hayFiltros && (
          <Button variant="outline" size="sm" onClick={limpiar} className="border-border text-muted-foreground">
            <X size={13} className="mr-1.5" />
            Limpiar
          </Button>
        )}

        <div className="ml-auto text-xs text-muted-foreground">
          {total} resultado{total !== 1 ? "s" : ""}
        </div>
      </div>

      {total === 0 && (
        <div className="bg-card border border-border rounded-[8px] p-12 text-center">
          <ShieldCheck size={36} className="mx-auto text-[#22C55E] mb-3" />
          <p className="text-sm text-muted-foreground">
            {hayFiltros ? "Sin resultados con los filtros actuales." : "Sin vencimientos próximos."}
          </p>
        </div>
      )}

      {(["LOMA_NEGRA", "YPF"] as const).map((c) => {
        const items = grouped.get(c);
        if (!items || items.length === 0) return null;
        return (
          <section key={c} className="bg-card border border-border rounded-[8px] shadow-sm">
            <div className="px-6 py-3 border-b border-border bg-muted/40">
              <h2 className="text-sm font-semibold text-foreground">
                {CLIENTE_LABEL[c]}
                <span className="ml-2 text-xs font-normal text-muted-foreground/70">
                  {items.length} pendiente{items.length !== 1 ? "s" : ""}
                </span>
              </h2>
            </div>
            <div className="divide-y divide-border">
              {items
                .sort((a, b) => (a.dias_restantes ?? 9999) - (b.dias_restantes ?? 9999))
                .map((r, idx) => (
                  <RowItem
                    key={`${r.requisito_id}-${r.chofer_id ?? r.camion_id ?? "empresa"}-${idx}`}
                    row={r}
                  />
                ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">{label}:</span>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
              active
                ? "bg-primary/10 border-primary/40 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function RowItem({ row }: { row: ComplianceEstadoRow }) {
  const target = row.chofer_nombre ?? row.camion_patente ?? "Empresa";
  const Icon = row.estado === "vencido" ? AlertTriangle : Clock;
  const tone = row.estado === "vencido" ? "error" : "warning";

  return (
    <div className="px-6 py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Icon size={16} className={row.estado === "vencido" ? "text-red-500" : "text-amber-500"} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">{row.requisito_nombre}</div>
          <div className="text-xs text-muted-foreground truncate">
            {target}
            <span className="text-muted-foreground/60"> · {NIVEL_LABEL[row.nivel]}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {row.fecha_vencimiento ? formatFecha(row.fecha_vencimiento) : ""}
        </span>
        <StatusBadge
          label={
            row.estado === "vencido"
              ? row.dias_restantes !== null
                ? `Vencido hace ${Math.abs(row.dias_restantes)}d`
                : "Vencido"
              : row.dias_restantes !== null
              ? `Vence en ${row.dias_restantes}d`
              : "Por vencer"
          }
          tone={tone}
        />
      </div>
    </div>
  );
}
