"use client";

import { useState, useTransition } from "react";
import { Calculator, ChevronDown, DollarSign, Info, Route, Settings, Weight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  buscarTarifaAplicable,
  type ClienteOption,
  type RutaOption,
  type TarifaConRelaciones,
  type TarifaParams,
} from "./actions";
import { getModalidadMeta } from "./validaciones";
import AjustesTarifa from "./AjustesTarifa";

type Props = {
  params: TarifaParams;
  clientes: ClienteOption[];
  rutas: RutaOption[];
  canWrite?: boolean;
};

function fmtARS(n: number): string {
  return n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type Resultado = {
  total: number;
  desglose: string;
  origen: "tarifa_cliente" | "params_globales";
  tarifa?: TarifaConRelaciones;
};

function calcularConTarifa(
  tarifa: TarifaConRelaciones,
  pesoKg: number,
  km: number,
): Resultado {
  const valor = Number(tarifa.valor);
  const meta = getModalidadMeta(tarifa.modalidad);

  let total = 0;
  let desglose = "";

  switch (tarifa.modalidad) {
    case "fija":
      total = valor;
      desglose = `Tarifa fija: ${tarifa.moneda} ${fmtARS(valor)}`;
      break;
    case "por_tonelada": {
      const toneladas = pesoKg / 1000;
      total = valor * toneladas;
      desglose = `${fmtARS(valor)} × ${toneladas.toFixed(3)} t`;
      break;
    }
    case "por_kilo":
      total = valor * pesoKg;
      desglose = `${fmtARS(valor)} × ${pesoKg} kg`;
      break;
    case "por_km": {
      const kmAplicable = tarifa.ruta_km ?? km;
      total = valor * kmAplicable;
      desglose = `${fmtARS(valor)} × ${kmAplicable} km${
        tarifa.ruta_km ? " (KM oficiales de la ruta)" : ""
      }`;
      break;
    }
  }

  return {
    total,
    desglose: `${meta.label} — ${desglose}`,
    origen: "tarifa_cliente",
    tarifa,
  };
}

function calcularConParams(
  params: TarifaParams,
  pesoKg: number,
  km: number,
): Resultado {
  const total =
    params.tarifa_base + pesoKg * params.precio_por_kg + km * params.precio_por_km;
  return {
    total,
    desglose: `${fmtARS(params.tarifa_base)} (base) + ${pesoKg} kg × ${fmtARS(
      params.precio_por_kg,
    )} + ${km} km × ${fmtARS(params.precio_por_km)}`,
    origen: "params_globales",
  };
}

export default function CalculadoraTarifasAvanzada({
  params,
  clientes,
  rutas,
  canWrite = false,
}: Props) {
  // Los valores base tenían pestaña propia ("Ajustes globales"), pero solo se
  // usan acá: son el cálculo de respaldo cuando el cliente no tiene tarifa.
  const [verAjustes, setVerAjustes] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [rutaId, setRutaId] = useState("");
  const [peso, setPeso] = useState("");
  const [distancia, setDistancia] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rutaSel = rutas.find((r) => r.id === rutaId);

  function onCalcular() {
    setError(null);
    setResultado(null);

    const pesoNum = peso === "" ? 0 : Number(peso);
    const kmManual = distancia === "" ? 0 : Number(distancia);

    if (!Number.isFinite(pesoNum) || pesoNum < 0) {
      setError("Peso inválido");
      return;
    }
    if (!Number.isFinite(kmManual) || kmManual < 0) {
      setError("Distancia inválida");
      return;
    }

    const kmFinal = rutaSel?.km_oficiales ?? kmManual;

    if (!clienteId) {
      setResultado(calcularConParams(params, pesoNum, kmFinal));
      return;
    }

    startTransition(async () => {
      const tarifa = await buscarTarifaAplicable(clienteId, rutaId || null);
      if (tarifa) {
        setResultado(calcularConTarifa(tarifa, pesoNum, kmFinal));
      } else {
        setResultado(calcularConParams(params, pesoNum, kmFinal));
      }
    });
  }

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="bg-card rounded-[8px] border border-border shadow-sm">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <Calculator size={16} className="text-primary" />
          <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Calculadora avanzada
          </h2>
        </div>

        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Cliente
            </Label>
            <Combobox
              value={clienteId}
              onValueChange={setClienteId}
              disabled={isPending}
              options={[
                { id: "", label: "Sin cliente (usa parámetros globales)" },
                ...clientes.map((c) => ({ id: c.id, label: c.nombre })),
              ]}
              searchPlaceholder="Buscar cliente..."
              triggerClassName="h-11 w-full"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Ruta
            </Label>
            <Combobox
              value={rutaId}
              onValueChange={setRutaId}
              disabled={isPending}
              options={[
                { id: "", label: "Sin ruta predefinida" },
                ...rutas.map((r) => ({
                  id: r.id,
                  label: `${r.origen} → ${r.destino} (${r.km_oficiales} km)`,
                })),
              ]}
              searchPlaceholder="Buscar ruta..."
              triggerClassName="h-11 w-full"
            />
            {rutaSel && (
              <p className="text-[10px] text-muted-foreground/70">
                KM oficiales: {rutaSel.km_oficiales}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="peso-calc"
              className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Peso carga
            </Label>
            <div className="relative">
              <Weight
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
              />
              <Input
                id="peso-calc"
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                placeholder="Ej. 1500"
                value={peso}
                onChange={(e) => setPeso(e.target.value)}
                disabled={isPending}
                className="h-11 pl-9 pr-12 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">
                kg.
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="dist-calc"
              className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
            >
              Distancia
            </Label>
            <div className="relative">
              <Route
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
              />
              <Input
                id="dist-calc"
                type="number"
                step="0.1"
                min="0"
                inputMode="decimal"
                placeholder={rutaSel ? `${rutaSel.km_oficiales} (auto)` : "Ej. 350"}
                value={distancia}
                onChange={(e) => setDistancia(e.target.value)}
                disabled={isPending || !!rutaSel}
                className="h-11 pl-9 pr-12 text-sm disabled:bg-muted/40"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/70">
                km.
              </span>
            </div>
            {rutaSel && (
              <p className="text-[10px] text-muted-foreground/70">
                Se usan los KM oficiales de la ruta
              </p>
            )}
          </div>

          {error && (
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 text-xs text-[#7F1D1D]">
              {error}
            </div>
          )}

          <Button
            type="button"
            variant="brand"
            size="lg"
            onClick={onCalcular}
            disabled={isPending}
            className="w-full"
          >
            <Calculator size={14} />
            {isPending ? "Calculando…" : "Calcular tarifa"}
          </Button>
        </div>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4">
        <div className="bg-card rounded-[8px] border border-border shadow-sm">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <DollarSign size={16} className="text-primary" />
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Resultado
            </h2>
          </div>
          <div className="p-5">
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-muted/40 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Total
              </span>
              <span className="text-2xl font-bold text-foreground font-mono">
                {resultado === null
                  ? "—"
                  : `${resultado.tarifa?.moneda ?? "ARS"} ${fmtARS(resultado.total)}`}
              </span>
            </div>

            {resultado && (
              <>
                <div className="space-y-2 text-xs">
                  <p className="text-muted-foreground">{resultado.desglose}</p>
                </div>

                <div
                  className={`mt-4 flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs ${
                    resultado.origen === "tarifa_cliente"
                      ? "bg-[#ECFDF5] text-[#064E3B] border border-[#A7F3D0]"
                      : "bg-[#FFFBEB] text-[#78350F] border border-[#FCD34D]"
                  }`}
                >
                  {resultado.origen === "tarifa_cliente" ? (
                    <>
                      <Zap size={12} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">Tarifa contractual aplicada</p>
                        {resultado.tarifa && (
                          <p className="mt-0.5">
                            {resultado.tarifa.cliente_nombre}
                            {resultado.tarifa.ruta_label
                              ? ` · ${resultado.tarifa.ruta_label}`
                              : ""}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Info size={12} className="mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold">
                          Cálculo con parámetros globales
                        </p>
                        <p className="mt-0.5">
                          {clienteId
                            ? "No hay tarifa contractual activa para esta combinación."
                            : "Seleccioná un cliente para usar tarifas contractuales."}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      </div>

      {/* Valores base del cálculo de respaldo. Plegado: se tocan una vez cada
          tanto, pero tienen que estar donde se usan y no en una pestaña aparte. */}
      <div className="rounded-[8px] border border-border bg-card shadow-sm">
        <button
          type="button"
          onClick={() => setVerAjustes((v) => !v)}
          aria-expanded={verAjustes}
          className="flex w-full items-center gap-2 px-4 py-3 text-left"
        >
          <Settings size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Valores base del cálculo</span>
          <span className="text-[11px] text-muted-foreground">
            base {fmtARS(params.tarifa_base)} · {fmtARS(params.precio_por_kg)}/kg · {fmtARS(params.precio_por_km)}/km
          </span>
          <ChevronDown
            size={15}
            className={`ml-auto shrink-0 text-muted-foreground transition-transform ${verAjustes ? "rotate-180" : ""}`}
          />
        </button>
        {verAjustes && (
          <div className="border-t border-border p-4">
            <p className="mb-3 max-w-2xl text-[12px] leading-snug text-muted-foreground">
              Se usan solo cuando el cliente no tiene una tarifa propia cargada. Si el cliente tiene
              tarifa, manda la del cliente y estos valores no intervienen.
            </p>
            <div className="max-w-md">
              <AjustesTarifa params={params} canWrite={canWrite} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
