"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Pencil, Trash2, MapPin, Phone, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { EmptyTableRow } from "@/components/ui/EmptyState";
import StatusBadge from "@/components/ui/StatusBadge";
import EntrevistaFormDialog from "./EntrevistaFormDialog";
import CvButton from "./CvButton";
import Semaforo from "./Semaforo";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { deleteEntrevistaAction } from "../actions";

export interface Entrevista {
  id: string;
  nombre: string;
  fecha_entrevista: string | null;
  edad: number | null;
  localidad: string | null;
  telefono: string | null;
  dni?: string | null;
  email?: string | null;
  puesto?: string | null;
  experiencia?: string | null;
  motivo_descarte?: string | null;
  observaciones: string | null;
  preocupacional: string; // 'no_aplica' | 'pendiente' | 'apto' | 'no_apto'
  resultado: string; // 'pendiente' | 'ingresa' | 'no_ingresa'
  etapa?: string; // pipeline: 'nuevo' | 'entrevista' | 'preocupacional' | 'ingresado' | 'descartado'
  // Seguimiento post-entrevista (texto libre del Excel):
  preocupacional_nota?: string | null;
  aprobado?: string | null;
  entro?: string | null;
  se_mantuvo?: string | null;
  /** Semáforo de Bárbara: 'me_gusto' | 'medio' | 'no_gusto' | null. */
  valoracion?: string | null;
  contacto_emergencia?: string | null;
  cv_count?: number; // cantidad de CVs adjuntos
  created_at: string;
}

const PREOCUPACIONAL_META: Record<string, { label: string; tone: "success" | "warning" | "error" | "neutral" }> = {
  no_aplica: { label: "—", tone: "neutral" },
  pendiente: { label: "A realizar", tone: "warning" },
  apto: { label: "Apto", tone: "success" },
  no_apto: { label: "No apto", tone: "error" },
};

const RESULTADO_META: Record<string, { label: string; tone: "success" | "warning" | "error" | "info" }> = {
  pendiente: { label: "Pendiente", tone: "warning" },
  ingresa: { label: "Ingresa", tone: "success" },
  no_ingresa: { label: "No ingresa", tone: "error" },
};

type ResultadoFilter = "todos" | "pendiente" | "ingresa" | "no_ingresa";

function fmtFecha(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function EntrevistasTable({
  entrevistas,
  canWrite,
  canDelete,
  onVerMas,
}: {
  entrevistas: Entrevista[];
  canWrite: boolean;
  canDelete: boolean;
  /** Abre la ficha completa del candidato (drawer). */
  onVerMas: (e: Entrevista) => void;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState("");
  const [resultado, setResultado] = useState<ResultadoFilter>("todos");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [eliminarDe, setEliminarDe] = useState<Entrevista | null>(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return entrevistas.filter((e) => {
      if (resultado !== "todos" && e.resultado !== resultado) return false;
      if (!q) return true;
      return (
        e.nombre.toLowerCase().includes(q) ||
        (e.localidad ?? "").toLowerCase().includes(q) ||
        (e.observaciones ?? "").toLowerCase().includes(q)
      );
    });
  }, [entrevistas, busqueda, resultado]);

  const confirmarEliminar = async () => {
    if (!eliminarDe) return;
    setDeletingId(eliminarDe.id);
    try {
      const res = await deleteEntrevistaAction(eliminarDe.id);
      if ("error" in res && res.error) {
        window.alert(res.error);
      } else {
        router.refresh();
      }
    } finally {
      setDeletingId(null);
      setEliminarDe(null);
    }
  };

  const noIngreso = (e: Entrevista) => e.resultado === "no_ingresa" || e.etapa === "descartado";
  const activos = filtradas.filter((e) => !noIngreso(e));
  const descartados = filtradas.filter(noIngreso);

  const fila = (e: Entrevista) => {
    const preo = PREOCUPACIONAL_META[e.preocupacional] ?? PREOCUPACIONAL_META.no_aplica;
    const res = RESULTADO_META[e.resultado] ?? RESULTADO_META.pendiente;
    return (
      <TableRow
        key={e.id}
        onClick={() => onVerMas(e)}
        className="cursor-pointer transition-colors hover:bg-primary/5"
        title={`Ver la ficha de ${e.nombre}`}
      >
        <TableCell className="font-medium text-foreground">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={(ev) => { ev.stopPropagation(); onVerMas(e); }}
              className="rounded font-medium text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              {e.nombre}
            </button>
            <span onClick={(ev) => ev.stopPropagation()}>
              <CvButton entrevistaId={e.id} nombre={e.nombre} count={e.cv_count ?? 0} canWrite={canWrite} />
            </span>
          </div>
          {e.telefono && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Phone className="size-3" />
              {e.telefono}
            </div>
          )}
        </TableCell>
        <TableCell>
          <Semaforo entrevistaId={e.id} valoracion={e.valoracion} canWrite={canWrite} size={12} />
        </TableCell>
        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Calendar className="size-3" />{fmtFecha(e.fecha_entrevista)}</span>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">{e.edad ?? "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {e.localidad ? <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{e.localidad}</span> : "—"}
        </TableCell>
        <TableCell className="max-w-xs">
          <span className="text-sm text-muted-foreground line-clamp-2" title="Click para leer completo">{e.observaciones || "—"}</span>
          {e.preocupacional_nota && (
            <span className="block text-xs text-amber-600 mt-0.5 line-clamp-1">Preocupacional: {e.preocupacional_nota}</span>
          )}
          {noIngreso(e) && e.motivo_descarte && (
            <span className="block text-xs text-rose-600 italic mt-0.5 line-clamp-1">Motivo: {e.motivo_descarte}</span>
          )}
          {e.se_mantuvo && (
            <span className="block text-xs text-orange-600 italic mt-0.5 line-clamp-1">Se mantuvo: {e.se_mantuvo}</span>
          )}
          <button
            type="button"
            onClick={(ev) => { ev.stopPropagation(); onVerMas(e); }}
            className="mt-0.5 text-xs font-medium text-primary hover:underline"
          >
            Ver más
          </button>
        </TableCell>
        <TableCell>
          {e.preocupacional === "no_aplica" ? <span className="text-sm text-muted-foreground">—</span> : <StatusBadge label={preo.label} tone={preo.tone} />}
        </TableCell>
        <TableCell><StatusBadge label={res.label} tone={res.tone} /></TableCell>
        {canWrite && (
          <TableCell className="text-right whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
            <div className="inline-flex items-center gap-1">
              <EntrevistaFormDialog entrevista={e}>
                <Button variant="ghost" size="icon" className="size-8" title="Editar"><Pencil className="size-4" /></Button>
              </EntrevistaFormDialog>
              {canDelete && (
                <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" title="Eliminar" disabled={deletingId === e.id} onClick={() => setEliminarDe(e)}>
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </TableCell>
        )}
      </TableRow>
    );
  };

  return (
    <div className="bg-card border border-border rounded-xl">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-border">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, localidad u observaciones..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={resultado} onValueChange={(v) => setResultado((v as ResultadoFilter) ?? "todos")}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue>{(v) => (({ todos: "Todos los resultados", pendiente: "Pendientes", ingresa: "Ingresaron", no_ingresa: "No ingresaron" } as Record<string, string>)[v as string] ?? "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los resultados</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="ingresa">Ingresaron</SelectItem>
            <SelectItem value="no_ingresa">No ingresaron</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabla */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead title="Semáforo: me gustó / más o menos / no me gustó">Valoración</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Edad</TableHead>
            <TableHead>De dónde es</TableHead>
            <TableHead>Observaciones</TableHead>
            <TableHead>Preocupacional</TableHead>
            <TableHead>Transporte</TableHead>
            {canWrite && <TableHead className="text-right">Acciones</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtradas.length === 0 ? (
            <EmptyTableRow message="No hay entrevistas que coincidan con la búsqueda." />
          ) : (
            <>
              {activos.map(fila)}
              {descartados.length > 0 && (
                <Fragment>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={canWrite ? 9 : 8} className="py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      No ingresaron / descartados ({descartados.length})
                    </TableCell>
                  </TableRow>
                  {descartados.map(fila)}
                </Fragment>
              )}
            </>
          )}
        </TableBody>
      </Table>

      <ConfirmDialog
        open={!!eliminarDe}
        onOpenChange={(o) => { if (!o) setEliminarDe(null); }}
        title="Eliminar candidato"
        description={eliminarDe ? <>Se va a eliminar a <strong className="text-foreground">{eliminarDe.nombre}</strong> y sus datos. Esta acción no se puede deshacer.</> : null}
        onConfirm={confirmarEliminar}
        loading={deletingId != null}
      />
    </div>
  );
}
