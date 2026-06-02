"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  CheckCircle2,
  Loader2,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import { createViajesBatchAction, type ViajeFormData, type ViajeFilaRapida } from "../actions";

// ── Tipos internos ────────────────────────────────────────────────────────────

type Fila = {
  id: number;
  fecha_viaje: string;
  estado: string;
  chofer_id: string;
  camion_id: string;
  origen_nombre: string;
  destino_nombre: string;
  km_con_carga: string;
  km_vacios: string;
  tonelaje_real: string;
  monto_flete: string;
  nro_viaje_ypf: string;
};

let nextId = 1;

const HOY = new Date().toISOString().slice(0, 10);

function filaVacia(overrides?: Partial<Fila>): Fila {
  return {
    id: nextId++,
    fecha_viaje: HOY,
    estado: "en_curso",
    chofer_id: "",
    camion_id: "",
    origen_nombre: "",
    destino_nombre: "",
    km_con_carga: "0",
    km_vacios: "0",
    tonelaje_real: "0",
    monto_flete: "0",
    nro_viaje_ypf: "",
    ...overrides,
  };
}

const ESTADOS = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en_curso", label: "En curso" },
  { value: "cerrado", label: "Cerrado" },
];

// ── Componente ────────────────────────────────────────────────────────────────

export default function CargaRapidaGrid({ data }: { data: ViajeFormData }) {
  const router = useRouter();

  // Selectores globales (aplican a todas las filas por defecto)
  const [globalClienteId, setGlobalClienteId] = useState("");
  const [globalTipoCargaId, setGlobalTipoCargaId] = useState(
    data.tipos_carga[0]?.id ?? "",
  );

  const [filas, setFilas] = useState<Fila[]>([filaVacia()]);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<{ ok: boolean; creados?: number; mensaje: string } | null>(null);
  const [erroresValidacion, setErroresValidacion] = useState<{ fila: number; mensaje: string }[]>([]);

  // Mapa chofer_id → camion_id para auto-completar
  const camionPorChofer = new Map<string, string>(
    data.choferes
      .filter((c) => c.camionId)
      .map((c) => [c.id, c.camionId!]),
  );

  const actualizarFila = useCallback(
    (id: number, campo: keyof Fila, valor: string) => {
      setFilas((prev) =>
        prev.map((f) => {
          if (f.id !== id) return f;
          const updated = { ...f, [campo]: valor };
          // Auto-completar camión al cambiar chofer
          if (campo === "chofer_id" && camionPorChofer.has(valor)) {
            updated.camion_id = camionPorChofer.get(valor)!;
          }
          return updated;
        }),
      );
    },
    [camionPorChofer],
  );

  const agregarFila = () => setFilas((prev) => [...prev, filaVacia()]);

  const eliminarFila = (id: number) =>
    setFilas((prev) => (prev.length > 1 ? prev.filter((f) => f.id !== id) : prev));

  const duplicarFila = (id: number) => {
    setFilas((prev) => {
      const idx = prev.findIndex((f) => f.id === id);
      if (idx === -1) return prev;
      const copia = { ...prev[idx], id: nextId++, nro_viaje_ypf: "" };
      const next = [...prev];
      next.splice(idx + 1, 0, copia);
      return next;
    });
  };

  const handleGuardar = async () => {
    if (!globalClienteId) {
      setResultado({ ok: false, mensaje: "Seleccioná un cliente global antes de guardar." });
      return;
    }
    if (!globalTipoCargaId) {
      setResultado({ ok: false, mensaje: "Seleccioná un tipo de carga global antes de guardar." });
      return;
    }

    const payload: ViajeFilaRapida[] = filas.map((f) => ({
      fecha_viaje: f.fecha_viaje,
      estado: f.estado,
      cliente_id: globalClienteId,
      chofer_id: f.chofer_id,
      camion_id: f.camion_id,
      tipo_carga_id: globalTipoCargaId,
      origen_nombre: f.origen_nombre.trim() || null,
      destino_nombre: f.destino_nombre.trim() || null,
      km_con_carga: Number(f.km_con_carga) || 0,
      km_vacios: Number(f.km_vacios) || 0,
      tonelaje_real: Number(f.tonelaje_real) || 0,
      monto_flete: Number(f.monto_flete) || 0,
      nro_viaje_ypf: f.nro_viaje_ypf.trim() || null,
    }));

    setGuardando(true);
    setResultado(null);
    setErroresValidacion([]);

    const res = await createViajesBatchAction(payload);

    setGuardando(false);

    if (res.ok) {
      setResultado({ ok: true, creados: res.creados, mensaje: `${res.creados} viaje(s) creados correctamente.` });
      // Limpiar filas y dejar una nueva lista para seguir cargando
      setFilas([filaVacia()]);
      router.refresh();
    } else {
      if (res.errores?.length) {
        setErroresValidacion(res.errores);
      }
      setResultado({ ok: false, mensaje: res.error ?? "Error al guardar los viajes." });
    }
  };

  return (
    <div className="space-y-5">
      {/* Selectores globales */}
      <div className="bg-card border border-border rounded-[8px] px-5 py-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1 min-w-[220px]">
          <label className="text-xs font-semibold text-muted-foreground">
            Cliente <span className="text-red-500">*</span>
          </label>
          <div className="relative flex items-center h-9 rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]">
            <select
              value={globalClienteId}
              onChange={(e) => setGlobalClienteId(e.target.value)}
              className="w-full h-full px-3 pr-8 text-sm bg-transparent border-0 outline-none text-foreground appearance-none cursor-pointer"
            >
              <option value="" disabled>Seleccioná un cliente...</option>
              {data.clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 text-muted-foreground/70 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-1 min-w-[180px]">
          <label className="text-xs font-semibold text-muted-foreground">
            Tipo de carga <span className="text-red-500">*</span>
          </label>
          <div className="relative flex items-center h-9 rounded-lg border border-border bg-card overflow-hidden focus-within:ring-2 focus-within:ring-[#0088D1]/20 focus-within:border-[#0088D1]">
            <select
              value={globalTipoCargaId}
              onChange={(e) => setGlobalTipoCargaId(e.target.value)}
              className="w-full h-full px-3 pr-8 text-sm bg-transparent border-0 outline-none text-foreground appearance-none cursor-pointer"
            >
              <option value="" disabled>Seleccioná...</option>
              {data.tipos_carga.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-2 text-muted-foreground/70 pointer-events-none" />
          </div>
        </div>

        <p className="text-xs text-muted-foreground/80 self-center">
          Aplican a todas las filas. Podés cambiarlos por fila directamente en la tabla.
        </p>
      </div>

      {/* Datalist puntos de ruta */}
      <datalist id="carga-rapida-puntos">
        {data.puntos_ruta.map((p) => (
          <option key={p.id} value={p.label} />
        ))}
      </datalist>

      {/* Grilla */}
      <div className="bg-card border border-border rounded-[8px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr className="bg-muted/40">
                {[
                  "Fecha",
                  "Estado",
                  "Chofer",
                  "Camión",
                  "Origen",
                  "Destino",
                  "KM carga",
                  "KM vacíos",
                  "Tonelaje",
                  "$ Flete",
                  "Nº YPF",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide border-b border-border whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((fila, idx) => {
                const filaError = erroresValidacion.find((e) => e.fila === idx + 1);
                return (
                  <tr
                    key={fila.id}
                    className={`border-b border-border/60 hover:bg-muted/20 transition-colors ${filaError ? "bg-red-50/50" : ""}`}
                  >
                    {/* Fecha */}
                    <td className="px-1 py-1">
                      <input
                        type="date"
                        value={fila.fecha_viaje}
                        onChange={(e) => actualizarFila(fila.id, "fecha_viaje", e.target.value)}
                        className="h-8 w-32 px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Estado */}
                    <td className="px-1 py-1">
                      <div className="relative">
                        <select
                          value={fila.estado}
                          onChange={(e) => actualizarFila(fila.id, "estado", e.target.value)}
                          className="h-8 w-28 pl-2 pr-6 text-xs rounded border border-border bg-card text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                        >
                          {ESTADOS.map((e) => (
                            <option key={e.value} value={e.value}>{e.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={11} className="absolute right-1.5 top-2 text-muted-foreground/70 pointer-events-none" />
                      </div>
                    </td>

                    {/* Chofer */}
                    <td className="px-1 py-1">
                      <div className="relative">
                        <select
                          value={fila.chofer_id}
                          onChange={(e) => actualizarFila(fila.id, "chofer_id", e.target.value)}
                          className={`h-8 w-40 pl-2 pr-6 text-xs rounded border bg-card text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] ${!fila.chofer_id ? "border-amber-300" : "border-border"}`}
                        >
                          <option value="">— Elegí —</option>
                          {data.choferes.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={11} className="absolute right-1.5 top-2 text-muted-foreground/70 pointer-events-none" />
                      </div>
                    </td>

                    {/* Camión */}
                    <td className="px-1 py-1">
                      <div className="relative">
                        <select
                          value={fila.camion_id}
                          onChange={(e) => actualizarFila(fila.id, "camion_id", e.target.value)}
                          className={`h-8 w-32 pl-2 pr-6 text-xs rounded border bg-card text-foreground appearance-none focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1] ${!fila.camion_id ? "border-amber-300" : "border-border"}`}
                        >
                          <option value="">— Elegí —</option>
                          {data.camiones.map((c) => (
                            <option key={c.id} value={c.id}>{c.label}</option>
                          ))}
                        </select>
                        <ChevronDown size={11} className="absolute right-1.5 top-2 text-muted-foreground/70 pointer-events-none" />
                      </div>
                    </td>

                    {/* Origen */}
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={fila.origen_nombre}
                        onChange={(e) => actualizarFila(fila.id, "origen_nombre", e.target.value)}
                        placeholder="Origen..."
                        list="carga-rapida-puntos"
                        className="h-8 w-28 px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Destino */}
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={fila.destino_nombre}
                        onChange={(e) => actualizarFila(fila.id, "destino_nombre", e.target.value)}
                        placeholder="Destino..."
                        list="carga-rapida-puntos"
                        className="h-8 w-28 px-2 text-xs rounded border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* KM carga */}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={fila.km_con_carga}
                        onChange={(e) => actualizarFila(fila.id, "km_con_carga", e.target.value)}
                        min="0"
                        className="h-8 w-20 px-2 text-xs rounded border border-border bg-card text-foreground text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* KM vacíos */}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={fila.km_vacios}
                        onChange={(e) => actualizarFila(fila.id, "km_vacios", e.target.value)}
                        min="0"
                        className="h-8 w-20 px-2 text-xs rounded border border-border bg-card text-foreground text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Tonelaje */}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={fila.tonelaje_real}
                        onChange={(e) => actualizarFila(fila.id, "tonelaje_real", e.target.value)}
                        min="0"
                        step="0.01"
                        className="h-8 w-20 px-2 text-xs rounded border border-border bg-card text-foreground text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Monto flete */}
                    <td className="px-1 py-1">
                      <input
                        type="number"
                        value={fila.monto_flete}
                        onChange={(e) => actualizarFila(fila.id, "monto_flete", e.target.value)}
                        min="0"
                        className="h-8 w-24 px-2 text-xs rounded border border-border bg-card text-foreground text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Nº YPF */}
                    <td className="px-1 py-1">
                      <input
                        type="text"
                        value={fila.nro_viaje_ypf}
                        onChange={(e) => actualizarFila(fila.id, "nro_viaje_ypf", e.target.value)}
                        placeholder="Opcional"
                        maxLength={60}
                        className="h-8 w-24 px-2 text-xs rounded border border-border bg-card text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-[#0088D1]/30 focus:border-[#0088D1]"
                      />
                    </td>

                    {/* Acciones fila */}
                    <td className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Duplicar fila"
                          onClick={() => duplicarFila(fila.id)}
                          className="size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-xs font-bold"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          title="Eliminar fila"
                          onClick={() => eliminarFila(fila.id)}
                          disabled={filas.length === 1}
                          className="size-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                        >
                          <Trash2 size={13} />
                        </button>
                        {filaError && (
                          <span title={filaError.mensaje}>
                            <AlertTriangle size={13} className="text-red-500" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer de la grilla */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={agregarFila}
            className="gap-1.5 h-8 text-xs"
          >
            <Plus size={13} /> Agregar fila
          </Button>
          <span className="text-xs text-muted-foreground/80">
            {filas.length} fila{filas.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Feedback */}
      {resultado && (
        <div
          className={`flex items-start gap-3 rounded-[8px] px-4 py-3 text-sm border ${
            resultado.ok
              ? "bg-[#ECFDF5] border-[#6EE7B7] text-[#064E3B]"
              : "bg-[#FEF2F2] border-[#FECACA] text-[#7F1D1D]"
          }`}
        >
          {resultado.ok ? (
            <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-[#10B981]" />
          ) : (
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-red-500" />
          )}
          <span className="font-medium">{resultado.mensaje}</span>
        </div>
      )}

      {erroresValidacion.length > 0 && (
        <ul className="text-xs text-red-600 space-y-0.5 pl-4 list-disc">
          {erroresValidacion.map((e) => (
            <li key={e.fila}>
              <strong>Fila {e.fila}:</strong> {e.mensaje}
            </li>
          ))}
        </ul>
      )}

      {/* Botón guardar */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleGuardar}
          disabled={guardando}
          className="bg-[#0088D1] hover:bg-[#0277BD] text-white font-bold px-8 h-10 gap-2"
        >
          {guardando ? (
            <><Loader2 size={15} className="animate-spin" /> Guardando...</>
          ) : (
            <><CheckCircle2 size={15} /> Guardar {filas.length} viaje{filas.length !== 1 ? "s" : ""}</>
          )}
        </Button>
      </div>
    </div>
  );
}
