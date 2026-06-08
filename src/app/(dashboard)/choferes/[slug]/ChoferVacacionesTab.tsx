"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Palmtree, Plus, Save } from "lucide-react";
import CargarAusenciaDialog from "./CargarAusenciaDialog";
import { guardarSaldoVacacionesAction } from "./actions";
import type { Ausencia, VacacionesSaldo } from "./types";
import { formatFecha } from "@/lib/utils";

interface Props {
  chofer_id: string;
  saldo: VacacionesSaldo;
  ausencias: Ausencia[];
  can_write: boolean;
  onRefresh: () => void;
}

export default function ChoferVacacionesTab({
  chofer_id,
  saldo,
  ausencias,
  can_write,
  onRefresh,
}: Props) {
  const [corresponden, setCorresponden] = useState(String(saldo.dias_correspondientes));
  const [adeudados, setAdeudados] = useState(String(saldo.dias_adeudados));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Períodos de vacaciones ya tomados (ausencias marcadas como vacaciones).
  const periodos = ausencias.filter((a) => a.es_vacaciones);

  const correspondenNum = Number(corresponden) || 0;
  const adeudadosNum = Number(adeudados) || 0;
  const disponibles = correspondenNum + adeudadosNum - saldo.dias_tomados;

  const guardar = async () => {
    setSaving(true);
    setError(null);
    const res = await guardarSaldoVacacionesAction(chofer_id, {
      dias_correspondientes: correspondenNum,
      dias_adeudados: adeudadosNum,
    });
    setSaving(false);
    if (res.error) setError(res.error);
    else onRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Palmtree size={16} className="text-primary" />
          Saldo de vacaciones
        </h3>
        {can_write && (
          <Button
            variant="outline"
            size="sm"
            className="border-[#CBD5E1] text-foreground/90 hover:bg-muted/40"
            onClick={() => setDialogOpen(true)}
          >
            <Plus size={13} className="mr-1.5 text-primary" />
            Cargar vacaciones
          </Button>
        )}
      </div>

      {/* Resumen de saldo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SaldoCard label="Corresponden (período)" value={correspondenNum} tone="muted" />
        <SaldoCard label="Adeudados (anteriores)" value={adeudadosNum} tone="muted" />
        <SaldoCard label="Tomados" value={saldo.dias_tomados} tone="warning" />
        <SaldoCard
          label="Disponibles"
          value={disponibles}
          tone={disponibles < 0 ? "error" : "success"}
        />
      </div>

      {/* Edición del saldo */}
      {can_write && (
        <div className="bg-card rounded-[8px] border border-border p-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Cargá los días que le corresponden del período y los adeudados de períodos
            anteriores. Los <span className="font-medium">tomados</span> se calculan solos a
            partir de las vacaciones cargadas.
          </p>
          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Días que corresponden</label>
              <Input
                type="number"
                min={0}
                value={corresponden}
                onChange={(e) => setCorresponden(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Días adeudados</label>
              <Input
                type="number"
                min={0}
                value={adeudados}
                onChange={(e) => setAdeudados(e.target.value)}
                className="w-40"
              />
            </div>
            <Button variant="brand" onClick={guardar} disabled={saving}>
              <Save size={14} className="mr-1.5" />
              {saving ? "Guardando..." : "Guardar saldo"}
            </Button>
          </div>
        </div>
      )}

      {/* Listado de vacaciones tomadas */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-2">
          Vacaciones cargadas
          <span className="ml-2 text-xs font-normal text-muted-foreground/70">
            {periodos.length} período{periodos.length !== 1 ? "s" : ""}
          </span>
        </h4>
        {periodos.length === 0 ? (
          <EmptyState icon={Palmtree} message="Sin vacaciones cargadas" />
        ) : (
          <div className="space-y-2">
            {periodos.map((a) => (
              <div
                key={a.id}
                className="bg-card rounded-[8px] border border-border p-3 flex items-center justify-between gap-3 flex-wrap"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-foreground">
                    {formatFecha(a.fecha_inicio)}
                    <span className="text-muted-foreground mx-1.5">→</span>
                    {formatFecha(a.fecha_fin)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                    {a.dias} día{a.dias !== 1 ? "s" : ""}
                  </span>
                  {a.en_curso && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">
                      En curso
                    </span>
                  )}
                </div>
                {a.autorizado_por_nombre && (
                  <span className="text-xs text-muted-foreground">
                    Autorizó: {a.autorizado_por_nombre}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Las vacaciones se cargan como una ausencia (también aparecen en Logística / Viajes).
          Para editarlas o cancelarlas, usá la pestaña <span className="font-medium">Ausencias</span>.
        </p>
      </div>

      <CargarAusenciaDialog
        chofer_id={chofer_id}
        ausencia={null}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        defaultVacaciones
        onSuccess={() => {
          setDialogOpen(false);
          onRefresh();
        }}
      />
    </div>
  );
}

function SaldoCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "muted" | "success" | "warning" | "error";
}) {
  const toneClass =
    tone === "success"
      ? "text-[#065F46]"
      : tone === "warning"
        ? "text-[#92400E]"
        : tone === "error"
          ? "text-[#991B1B]"
          : "text-foreground";
  return (
    <div className="rounded-[8px] border border-border bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
