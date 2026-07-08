"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Wrench, CircleDot, Package, BellRing, BarChart3,
  Truck, Calendar, DollarSign, Search, MousePointer2,
  FileSpreadsheet, Download, ArrowRight, ArrowLeft, Check, Sparkles,
} from "lucide-react";

// Tutorial de la sección Mantenimiento, en el mismo formato carrusel animado que
// Sueldos: mini-mockups de la UI real. Cubre las 5 pestañas (Servicios, Roturas,
// Insumos, Alertas, Reportes) + cómo editar/agregar/borrar y exportar.

type Paso = { id: string; titulo: string; desc: React.ReactNode; ilustracion: React.ReactNode };

export default function MantenimientoTutorial({
  canWrite,
  onClose,
}: {
  canWrite: boolean;
  onClose: () => void;
}) {
  const pasos: Paso[] = [
    {
      id: "intro",
      titulo: "Todo el mantenimiento de la flota, en una pantalla",
      desc: (
        <>Cinco pestañas: <strong>Servicios</strong>, <strong>Roturas</strong>, <strong>Insumos</strong>, <strong>Alertas</strong> y <strong>Reportes</strong>. Arriba a la derecha tenés los botones para cargar y el menú <strong>Exportar</strong>.</>
      ),
      ilustracion: <IlustracionTabs />,
    },
    {
      id: "servicios",
      titulo: "Servicios — services y reparaciones",
      desc: (
        <>{canWrite ? <>Con <strong>«Cargar servicio»</strong> registrás</> : <>Acá se ven</>} el service o reparación: unidad, tipo, fecha, KM y costo. Si cargás el <strong>próximo KM/fecha</strong>, se genera solo el aviso en Alertas. El costo se registra en Caja.</>
      ),
      ilustracion: <IlustracionServicio />,
    },
    {
      id: "roturas",
      titulo: "Roturas — gomas y roturas imprevistas",
      desc: (
        <>{canWrite ? <>Con <strong>«Registrar rotura»</strong> anotás</> : <>Acá se ven</>} lo que se rompió (goma, espejo, óptica…). Al elegir el <strong>insumo del catálogo</strong>, el <strong>costo se trae solo</strong> y queda editable. Sirve para ver qué chofer rompe más.</>
      ),
      ilustracion: <IlustracionRotura />,
    },
    {
      id: "insumos",
      titulo: "Insumos — el catálogo de precios",
      desc: (
        <>El listado de insumos comunes con <strong>marca</strong> y <strong>precio de referencia</strong>. {canWrite ? <>Tocá cualquier <strong>celda</strong> (nombre, marca o precio) y la editás al toque, sin ventanas; el <strong>switch</strong> activa o desactiva. Podés</> : <>Podés</>} <strong>buscar y ordenar</strong>. Si un precio quedó viejo, aparece el aviso <strong>«Desactualizado»</strong>.</>
      ),
      ilustracion: <IlustracionInsumos />,
    },
    {
      id: "alertas-reportes",
      titulo: "Alertas y Reportes",
      desc: (
        <><strong>Alertas</strong> te muestra los próximos services que vencen (por fecha o km). <strong>Reportes</strong> arma solo el <strong>costo de repuestos por chofer</strong> y las <strong>visitas a taller por unidad</strong>.</>
      ),
      ilustracion: <IlustracionReportes />,
    },
    {
      id: "exportar",
      titulo: "Exportá a Excel: una vista o todo junto",
      desc: (
        <>Desde <strong>Exportar</strong> bajás una sola vista (Insumos, Servicios, Roturas…) o <strong>todo junto</strong> en un Excel con una hoja por vista, con el diseño de siempre.</>
      ),
      ilustracion: <IlustracionExport />,
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

        {/* Texto del paso */}
        <div className="px-6 pt-5 pb-2 min-h-[128px]">
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

function IlustracionTabs() {
  const tabs = [
    { icon: Wrench, label: "Servicios", color: "text-sky-600 bg-sky-50 border-sky-200/70" },
    { icon: CircleDot, label: "Roturas", color: "text-amber-600 bg-amber-50 border-amber-200/70" },
    { icon: Package, label: "Insumos", color: "text-violet-600 bg-violet-50 border-violet-200/70" },
    { icon: BellRing, label: "Alertas", color: "text-rose-600 bg-rose-50 border-rose-200/70" },
    { icon: BarChart3, label: "Reportes", color: "text-emerald-600 bg-emerald-50 border-emerald-200/70" },
  ];
  return (
    <div className="flex items-end gap-2.5">
      {tabs.map((t, idx) => {
        const Icon = t.icon;
        return (
          <motion.div key={t.label}
            initial={{ opacity: 0, y: 14, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.08 + idx * 0.1, type: "spring", stiffness: 260, damping: 20 }}
            className="flex flex-col items-center justify-center gap-1.5 w-[74px] h-[74px] rounded-xl border shadow-sm bg-card"
          >
            <span className={`h-9 w-9 rounded-full flex items-center justify-center border ${t.color}`}><Icon size={16} /></span>
            <span className="text-[10px] font-semibold text-foreground text-center px-1 leading-tight">{t.label}</span>
          </motion.div>
        );
      })}
    </div>
  );
}

function IlustracionServicio() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
      className="bg-card border border-border rounded-xl shadow-md w-full max-w-[420px] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex items-center gap-2 bg-gradient-to-br from-muted/50 to-transparent">
        <span className="size-7 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center"><Wrench size={14} /></span>
        <div className="text-foreground text-[11px] font-bold uppercase tracking-wider">Cargar servicio</div>
      </div>
      <div className="p-3.5 space-y-2.5">
        <div className="grid grid-cols-2 gap-2.5">
          <MiniField label="Unidad" value="AB 123 CD" icon={<Truck size={10} />} />
          <MiniField label="Tipo" value="Cambio de aceite" />
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          <MiniField label="Fecha" value="20/05" icon={<Calendar size={10} />} />
          <MiniField label="KM" value="184.520" />
          <MiniField label="Costo" value="$150k" icon={<DollarSign size={10} />} />
        </div>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }}
          className="bg-[#E1F5FE] text-[#004A99] text-[10px] px-2.5 py-1.5 rounded-md">
          Cargá el próximo KM/fecha → aparece el aviso en Alertas.
        </motion.div>
      </div>
    </motion.div>
  );
}

function IlustracionRotura() {
  return (
    <div className="flex items-center gap-3">
      <motion.div
        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
        className="flex flex-col items-center justify-center w-28 h-20 rounded-xl border border-amber-200 bg-amber-50/70 shadow-sm">
        <span className="text-[9px] uppercase text-amber-700 font-semibold">Insumo</span>
        <CircleDot size={18} className="text-amber-600 my-0.5" />
        <span className="text-[10px] font-semibold text-foreground">Goma 295/80</span>
      </motion.div>
      <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }} className="text-muted-foreground">
        <ArrowRight size={18} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45, type: "spring", stiffness: 240 }}
        className="flex flex-col items-center justify-center w-28 h-20 rounded-xl border-2 border-primary/40 bg-primary/5 shadow-sm">
        <span className="text-[9px] uppercase text-primary font-semibold">Costo auto</span>
        <span className="text-sm font-mono font-bold text-primary mt-0.5">$ 850.000</span>
        <span className="text-[8px] text-muted-foreground mt-0.5">editable</span>
      </motion.div>
    </div>
  );
}

function IlustracionInsumos() {
  const rows = [
    { n: "Goma / cubierta", m: "Michelin", p: "$ 850k", old: false },
    { n: "Lámpara H7", m: "—", p: "$ 12k", old: true },
    { n: "Espejo", m: "—", p: "$ 45k", old: false },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="w-full max-w-sm rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      {/* Barra de búsqueda simulada */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-border bg-muted/40">
        <Search size={11} className="text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground">Buscar insumo…</span>
        <span className="ml-auto text-[8px] font-semibold px-1.5 py-0.5 rounded bg-card border border-border text-muted-foreground">3 insumos</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-3 py-1 bg-muted text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
        <span>Insumo</span><span>Marca</span><span>Precio</span>
      </div>
      {rows.map((r, idx) => {
        const destacada = idx === 0;
        return (
          <motion.div key={r.n}
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + idx * 0.1 }}
            className="relative grid grid-cols-[1fr_auto_auto] gap-3 items-center px-3 py-1.5 border-t border-border/60 text-[11px]">
            <span className="font-medium text-foreground truncate">{r.n}</span>
            <span className="text-muted-foreground text-[10px]">{r.m}</span>
            <span className="inline-flex items-center gap-1 font-mono text-foreground">
              {r.p}
              {r.old && <span className="text-[7px] font-bold uppercase px-1 py-0.5 rounded bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]">Vieja</span>}
            </span>
            {destacada && (
              <motion.span
                className="absolute -bottom-1 right-8 text-primary drop-shadow z-10"
                animate={{ scale: [1, 0.8, 1], rotate: [0, -8, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, times: [0, 0.35, 0.6], ease: "easeInOut" }}
              >
                <MousePointer2 size={14} fill="currentColor" />
              </motion.span>
            )}
          </motion.div>
        );
      })}
    </motion.div>
  );
}

function IlustracionReportes() {
  const bars = [
    { n: "Paterno", w: 92, v: "1,1M" },
    { n: "Albornoz", w: 58, v: "690k" },
    { n: "Heim", w: 34, v: "410k" },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}
      className="w-full max-w-sm rounded-lg border border-border bg-card shadow-sm p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 mb-2.5">
        <DollarSign size={12} /> Costo de repuestos por chofer
      </div>
      <div className="space-y-2">
        {bars.map((b, idx) => (
          <div key={b.n} className="flex items-center gap-2 text-[11px]">
            <span className="w-16 text-foreground truncate">{b.n}</span>
            <div className="flex-1 h-3 rounded-sm bg-muted overflow-hidden">
              <motion.div className="h-full bg-emerald-500 rounded-sm"
                initial={{ width: 0 }} animate={{ width: `${b.w}%` }}
                transition={{ delay: 0.2 + idx * 0.12, duration: 0.5, ease: "easeOut" }} />
            </div>
            <span className="w-10 text-right font-mono font-semibold text-emerald-700">{b.v}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

const HOJAS = [
  { l: "Insumos", c: "bg-violet-100 text-violet-700" },
  { l: "Servicios", c: "bg-sky-100 text-sky-700" },
  { l: "Roturas", c: "bg-amber-100 text-amber-700" },
  { l: "Reportes", c: "bg-emerald-100 text-emerald-700" },
];
function IlustracionExport() {
  return (
    <div className="relative flex items-center gap-6">
      <div className="relative w-28 h-24">
        {HOJAS.map((h, idx) => (
          <motion.div key={h.l}
            initial={{ opacity: 0, x: 0, y: 0, rotate: 0 }}
            animate={{ opacity: 1, x: idx * 8, y: idx * -5, rotate: (idx - 1.5) * 3 }}
            transition={{ delay: 0.12 + idx * 0.1, type: "spring", stiffness: 200, damping: 18 }}
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
      <motion.div className="flex flex-col items-center gap-1 text-primary"
        animate={{ y: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}>
        <Download size={26} />
        <span className="text-[10px] font-semibold">.xlsx</span>
      </motion.div>
    </div>
  );
}

// Campo simulado para los mini-mockups de formulario.
function MiniField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[10px] text-foreground">
        {icon && <span className="text-muted-foreground">{icon}</span>}
        <span className="truncate font-medium">{value}</span>
      </div>
    </div>
  );
}
