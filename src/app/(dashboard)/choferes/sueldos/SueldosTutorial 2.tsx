"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Truck, Wallet, TrendingUp, FileSpreadsheet, MousePointer2, Plus,
  Download, ArrowRight, ArrowLeft, Check, Sparkles,
} from "lucide-react";

// Tutorial de la sección Sueldos en formato carrusel con ilustraciones animadas
// (mini-mockups de la UI real). Los pasos se arman según los permisos del usuario.

type Paso = { id: string; titulo: string; desc: React.ReactNode; ilustracion: React.ReactNode };

export default function SueldosTutorial({
  canChoferes, canAdmin, onClose,
}: {
  canChoferes: boolean;
  canAdmin: boolean;
  onClose: () => void;
}) {
  const hojasExport = [
    ...(canChoferes ? ["Choferes"] : []),
    ...(canAdmin ? ["Admin y taller", "Aumentos"] : []),
  ];
  const pasos: Paso[] = [
    {
      id: "intro",
      titulo: "Todo lo de sueldos, en un solo lugar",
      desc: (
        <>Tres pestañas según lo que liquides. El <strong>mes</strong> se cambia con el selector de arriba a la derecha, y con <strong>Exportar</strong> bajás todo a Excel.</>
      ),
      ilustracion: <IlustracionPestanas canChoferes={canChoferes} canAdmin={canAdmin} />,
    },
    ...(canChoferes ? [{
      id: "choferes",
      titulo: "Choferes — liquidación por viajes",
      desc: (
        <>El sistema arma solo los totales de cada chofer desde la hoja de ruta: <strong>viajes, km, toneladas</strong>, y separa <strong>al sur</strong> y <strong>zona petrolera</strong>.</>
      ),
      ilustracion: <IlustracionChoferes />,
    }] : []),
    ...(canAdmin ? [{
      id: "admin",
      titulo: "Admin y taller — planilla del mes",
      desc: (
        <>Por cada persona: <strong>sueldo base</strong> + comisión logística, combustible, plus YPF y sábados. El <strong>total</strong> se calcula solo y se compara contra la facturación.</>
      ),
      ilustracion: <IlustracionPlanilla />,
    }, {
      id: "aumentos",
      titulo: "Aumentos — la matriz mes a mes",
      desc: (
        <>El <strong>año</strong> va arriba (2025, 2026…) y el mes abajo. Tocá cualquier <strong>celda</strong> para cargar o editar un aumento, y con <strong>«Agregar mes»</strong> sumás columnas nuevas con el tiempo.</>
      ),
      ilustracion: <IlustracionMatriz />,
    }] : []),
    {
      id: "exportar",
      titulo: "Exportá todo a Excel",
      desc: (
        <>Un botón baja un Excel con el diseño de siempre: una hoja por vista que puedas ver ({hojasExport.join(" · ")}).</>
      ),
      ilustracion: <IlustracionExport hojas={hojasExport} />,
    },
  ];

  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;

  const ir = (delta: number) => {
    const next = i + delta;
    if (next < 0 || next >= pasos.length) return;
    setDir(delta);
    setI(next);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden" showCloseButton>
        {/* Escenario de la ilustración */}
        <div className="relative h-52 bg-gradient-to-br from-primary/5 via-muted/30 to-transparent border-b border-border overflow-hidden">
          <div className="absolute left-4 top-3.5 z-10 flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <Sparkles size={13} /> Guía rápida
          </div>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={paso.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="absolute inset-0 flex items-center justify-center px-6"
            >
              {paso.ilustracion}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Texto del paso — alto fijo para que los controles de abajo (dots y
            botón Siguiente) queden siempre en la misma posición entre pasos. */}
        <div className="px-6 pt-5 pb-2 h-[132px] overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={paso.id}
              custom={dir}
              initial={{ opacity: 0, x: dir * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -24 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-heading text-lg font-semibold text-foreground">{paso.titulo}</h2>
              <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{paso.desc}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Controles */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/40 px-6 py-3.5">
          <div className="flex items-center gap-1.5">
            {pasos.map((p, idx) => (
              <button key={p.id} type="button" aria-label={`Ir al paso ${idx + 1}`}
                onClick={() => { setDir(idx > i ? 1 : -1); setI(idx); }}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/40"}`} />
            ))}
          </div>
          <div className="flex items-center gap-2">
            {i > 0 && (
              <Button variant="ghost" size="sm" onClick={() => ir(-1)}><ArrowLeft size={14} /> Atrás</Button>
            )}
            {ultimo ? (
              <Button variant="brand" size="sm" onClick={onClose}><Check size={14} /> Entendido</Button>
            ) : (
              <Button variant="brand" size="sm" onClick={() => ir(1)}>Siguiente <ArrowRight size={14} /></Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Ilustraciones ──────────────────────────────────────────────────────────

function IlustracionPestanas({ canChoferes, canAdmin }: { canChoferes: boolean; canAdmin: boolean }) {
  const tabs = [
    ...(canChoferes ? [{ icon: Truck, label: "Choferes", color: "text-sky-600 bg-sky-50 border-sky-200/70" }] : []),
    ...(canAdmin ? [
      { icon: Wallet, label: "Admin y taller", color: "text-violet-600 bg-violet-50 border-violet-200/70" },
      { icon: TrendingUp, label: "Aumentos", color: "text-emerald-600 bg-emerald-50 border-emerald-200/70" },
    ] : []),
  ];
  return (
    <div className="flex items-center gap-3">
      {tabs.map((t, idx) => {
        const Icon = t.icon;
        return (
          <motion.div key={t.label}
            initial={{ opacity: 0, y: 14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.1 + idx * 0.12, type: "spring", stiffness: 260, damping: 20 }}
            className={`flex flex-col items-center justify-center gap-1.5 w-24 h-24 rounded-xl border shadow-sm bg-card`}
          >
            <span className={`h-10 w-10 rounded-full flex items-center justify-center border ${t.color}`}><Icon size={18} /></span>
            <span className="text-[11px] font-semibold text-foreground text-center px-1 leading-tight">{t.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function IlustracionChoferes() {
  const rows = [
    { n: "Albornoz", km: "3.400", z: "Sur" },
    { n: "Paterno", km: "2.100", z: "Pozo" },
    { n: "Heim", km: "4.050", z: "—" },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="w-full max-w-sm rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1.5 bg-muted text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Chofer</span><span>Km</span><span>Zona</span>
      </div>
      {rows.map((r, idx) => (
        <motion.div key={r.n}
          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + idx * 0.1 }}
          className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-1.5 border-t border-border/60 text-xs">
          <span className="font-medium text-foreground">{r.n}</span>
          <span className="font-mono text-muted-foreground">{r.km}</span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${r.z === "Sur" ? "bg-sky-50 text-sky-700" : r.z === "Pozo" ? "bg-amber-50 text-amber-700" : "text-muted-foreground/50"}`}>{r.z}</span>
        </motion.div>
      ))}
    </motion.div>
  );
}

function IlustracionPlanilla() {
  const cols = [
    { l: "Base", v: "3,1M" },
    { l: "Comis.", v: "290k" },
    { l: "Combus.", v: "100k" },
    { l: "Sáb.", v: "68k" },
  ];
  return (
    <div className="flex items-center gap-2">
      {cols.map((c, idx) => (
        <motion.div key={c.l}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + idx * 0.09 }}
          className="flex flex-col items-center justify-center w-16 h-16 rounded-lg border border-border bg-card shadow-sm">
          <span className="text-[9px] uppercase text-muted-foreground">{c.l}</span>
          <span className="text-xs font-mono font-semibold text-foreground">{c.v}</span>
        </motion.div>
      ))}
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5, type: "spring" }}
        className="text-muted-foreground font-bold">=</motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6, type: "spring", stiffness: 240 }}
        className="flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 border-primary/40 bg-primary/5 shadow-sm">
        <span className="text-[9px] uppercase text-primary font-semibold">Total</span>
        <span className="text-sm font-mono font-bold text-primary">3,5M</span>
      </motion.div>
    </div>
  );
}

function IlustracionMatriz() {
  return (
    <div className="relative w-full max-w-sm rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      {/* Banda de año */}
      <div className="grid grid-cols-[64px_1fr_1fr_1fr_1fr] text-center">
        <div className="bg-muted" />
        <div className="col-span-2 bg-muted py-1 text-[10px] font-bold text-muted-foreground border-l border-border">2025</div>
        <div className="col-span-2 bg-muted py-1 text-[10px] font-bold text-muted-foreground border-l border-border">2026</div>
      </div>
      {/* Meses */}
      <div className="grid grid-cols-[64px_1fr_1fr_1fr_1fr] text-center bg-muted/60 border-t border-border">
        <div className="py-1 text-[9px] font-bold uppercase text-muted-foreground text-left pl-2">Empl.</div>
        {["nov", "dic", "ene", "feb"].map((m) => (
          <div key={m} className="py-1 text-[9px] font-semibold capitalize text-muted-foreground border-l border-border/60">{m}</div>
        ))}
      </div>
      {/* Filas */}
      {[["De Brito", ["2,7M", "2,8M", "2,9M", "3,1M"]], ["Díaz", ["2,7M", "2,8M", "2,9M", "3,2M"]]].map(([n, vals], ri) => (
        <div key={n as string} className="grid grid-cols-[64px_1fr_1fr_1fr_1fr] text-center border-t border-border/60">
          <div className="py-1.5 text-[10px] font-semibold text-foreground text-left pl-2 truncate">{n as string}</div>
          {(vals as string[]).map((v, ci) => {
            const destacada = ri === 0 && ci === 3; // celda "feb" de la primera fila
            return (
              <div key={ci} className={`py-1.5 text-[10px] font-mono border-l border-border/40 ${destacada ? "relative text-primary font-bold" : "text-foreground"}`}>
                {v}
                {destacada && (
                  <>
                    <motion.span
                      className="absolute inset-0 rounded bg-primary/10 ring-1 ring-primary/40"
                      animate={{ opacity: [0, 1, 1, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.3, 0.7, 1] }}
                    />
                    {/* Cursor relativo a la celda: siempre apunta bien y "toca". */}
                    <motion.span
                      className="absolute -bottom-1 -right-1 text-primary drop-shadow z-10"
                      animate={{ scale: [1, 0.8, 1], rotate: [0, -8, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, times: [0, 0.35, 0.6], ease: "easeInOut" }}
                    >
                      <MousePointer2 size={15} fill="currentColor" />
                    </motion.span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {/* Chip "Agregar mes" que aparece arriba a la derecha */}
      <motion.div
        className="absolute top-1.5 right-1.5 flex items-center gap-1 text-[9px] font-semibold text-primary bg-card border border-primary/30 rounded px-1.5 py-0.5 shadow-sm"
        animate={{ opacity: [0, 0, 1, 1, 0], y: [4, 4, 0, 0, 4] }}
        transition={{ duration: 3.2, repeat: Infinity, times: [0, 0.4, 0.55, 0.85, 1] }}
      >
        <Plus size={9} /> Agregar mes
      </motion.div>
    </div>
  );
}

const HOJA_COLOR: Record<string, string> = {
  "Choferes": "bg-sky-100 text-sky-700",
  "Admin y taller": "bg-violet-100 text-violet-700",
  "Aumentos": "bg-emerald-100 text-emerald-700",
};
function IlustracionExport({ hojas }: { hojas: string[] }) {
  const items = hojas.map((l) => ({ l, c: HOJA_COLOR[l] ?? "bg-muted text-foreground" }));
  return (
    <div className="relative flex items-center gap-5">
      <div className="relative w-28 h-24">
        {items.map((h, idx) => (
          <motion.div key={h.l}
            initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
            animate={{ opacity: 1, x: idx * 10, y: idx * -6, rotate: (idx - 1) * 4 }}
            transition={{ delay: 0.15 + idx * 0.12, type: "spring", stiffness: 200, damping: 18 }}
            className="absolute left-2 top-4 w-24 h-16 rounded-lg border border-border bg-card shadow-md flex flex-col justify-center px-2 gap-1"
          >
            <div className="flex items-center gap-1">
              <FileSpreadsheet size={12} className="text-emerald-600" />
              <span className={`text-[8px] font-semibold px-1 py-0.5 rounded ${h.c}`}>{h.l}</span>
            </div>
            <div className="h-0.5 w-14 bg-border rounded" />
            <div className="h-0.5 w-10 bg-border rounded" />
          </motion.div>
        ))}
      </div>
      <motion.div
        className="flex flex-col items-center gap-1 text-primary"
        animate={{ y: [0, 5, 0] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <Download size={26} />
        <span className="text-[10px] font-semibold">.xlsx</span>
      </motion.div>
    </div>
  );
}
