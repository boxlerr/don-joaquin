"use client";

import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";
import {
  ShieldCheck,
  Lock,
  LockOpen,
  Plus,
  Pencil,
  Trash2,
  Mail,
  KeyRound,
  UserPlus,
  UserCog,
  Check,
  Crown,
  Clock,
  ArrowRight,
  CalendarClock,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers de mockup
// ---------------------------------------------------------------------------

const NIVEL_STYLE = {
  none: { t: "Sin acceso", c: "bg-muted text-muted-foreground" },
  read: { t: "Lectura", c: "bg-blue-50 text-blue-700" },
  write: { t: "Edición", c: "bg-green-50 text-green-700" },
} as const;

function Chip({ level, className = "" }: { level: keyof typeof NIVEL_STYLE; className?: string }) {
  const m = NIVEL_STYLE[level];
  return (
    <span className={`inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-semibold ${m.c} ${className}`}>
      {m.t}
    </span>
  );
}

function MiniField({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9px] font-semibold text-muted-foreground mb-0.5">{label}</div>
      <div className="h-7 px-2 text-[10px] rounded border border-border bg-card text-foreground inline-flex items-center gap-1.5 w-full">
        {icon && <span className="text-primary">{icon}</span>}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

function Estado({ activo }: { activo: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${activo ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
      <span className={`size-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-muted-foreground/50"}`} />
      {activo ? "Activo" : "Inactivo"}
    </span>
  );
}

// ===========================================================================
// TAB 1 — Usuarios
// ===========================================================================

function MockToolbar() {
  return (
    <div className="flex items-center justify-between gap-2">
      <div>
        <div className="text-foreground text-sm font-bold">Usuarios y Permisos</div>
        <div className="text-[10px] text-muted-foreground/70">Quién entra y qué puede hacer</div>
      </div>
      <div className="h-8 px-3 rounded-md text-[11px] font-semibold inline-flex items-center gap-1 bg-[#0088D1] text-white shadow-[0_0_0_4px_rgba(0,136,209,0.3)] ring-2 ring-white scale-105">
        <UserPlus size={12} /> Nuevo usuario
      </div>
    </div>
  );
}

function MockNuevoUsuario() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-2">
        <span className="size-6 rounded-full bg-[#E1F5FE] text-primary inline-flex items-center justify-center">
          <UserPlus size={13} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">Nuevo usuario</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <MiniField label="Nombre *" value="Virginia" />
          <MiniField label="Apellido" value="De Brito" />
        </div>
        <MiniField label="Email de acceso *" value="logistica@donjoaquin.com" icon={<Mail size={10} />} />
        <div className="grid grid-cols-2 gap-2">
          <MiniField label="Contraseña temporal *" value="••••••••" icon={<KeyRound size={10} />} />
          <MiniField label="Rol *" value="Rep. Logística" icon={<ShieldCheck size={10} />} />
        </div>
        <div className="flex justify-end pt-1.5 border-t border-border">
          <div className="h-7 px-3 text-[10px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
            <Check size={11} /> Crear usuario
          </div>
        </div>
      </div>
    </div>
  );
}

function MockPrimerIngreso() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px]">
        <div className="flex-1 rounded-lg border border-border bg-card px-3 py-2">
          <div className="text-[9px] font-bold text-muted-foreground uppercase">La persona entra con</div>
          <div className="text-foreground mt-0.5 flex items-center gap-1.5"><Mail size={11} className="text-primary" /> email + clave temporal</div>
        </div>
        <ArrowRight size={16} className="text-primary shrink-0" />
        <div className="flex-1 rounded-lg border-2 border-[#0088D1] bg-[#0088D1]/5 px-3 py-2">
          <div className="text-[9px] font-bold text-primary uppercase">El sistema la obliga a</div>
          <div className="text-foreground mt-0.5 flex items-center gap-1.5"><KeyRound size={11} className="text-primary" /> poner su propia clave</div>
        </div>
      </div>
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 px-2.5 py-2 flex items-center gap-1.5">
        <Check size={12} /> Queda <b>activa</b> al instante. Vos nunca ves la contraseña definitiva.
      </div>
    </div>
  );
}

function MockListado() {
  const rows = [
    { n: "Bárbara Joaquín", r: "Administrador", a: true },
    { n: "Pablo Díaz", r: "Operativo", a: true },
    { n: "Virginia De Brito", r: "Rep. Logística", a: false },
  ];
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2 bg-muted/50 px-3 py-1.5 text-[8px] font-bold uppercase text-muted-foreground">
        <span>Usuario</span>
        <span className="w-20">Rol</span>
        <span className="w-14 text-center">Estado</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.n} className={`grid grid-cols-[1fr_auto_auto] gap-2 items-center px-3 py-2 ${i > 0 ? "border-t border-border" : ""}`}>
          <span className="text-[11px] font-medium text-foreground truncate">{r.n}</span>
          <span className="w-20 text-[10px] text-muted-foreground truncate">{r.r}</span>
          <span className="w-14 flex justify-center"><Estado activo={r.a} /></span>
        </div>
      ))}
    </div>
  );
}

function MockAcciones() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-2.5">
        <div>
          <div className="text-[11px] font-semibold text-foreground">Virginia De Brito</div>
          <div className="text-[9px] text-muted-foreground">Rep. Logística</div>
        </div>
        <div className="inline-flex items-center gap-1.5">
          <span className="relative h-4 w-7 rounded-full bg-emerald-500">
            <span className="absolute right-0.5 top-0.5 size-3 rounded-full bg-white" />
          </span>
          <span className="text-[9px] font-bold text-emerald-600">Activo</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-primary" title="Reset contraseña"><KeyRound size={11} /></span>
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-primary" title="Editar"><Pencil size={11} /></span>
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-destructive" title="Eliminar"><Trash2 size={11} /></span>
        </div>
      </div>
      <div className="px-3 py-1.5 border-t border-border bg-[#F0F9FF] text-[10px] text-[#075985] flex items-center gap-1.5">
        <KeyRound size={11} className="text-primary" /> La llave 🔑 manda un link para que la persona ponga una clave nueva.
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 2 — Roles y matriz
// ===========================================================================

function MockMatrix() {
  const cols = ["Logíst.", "Flota", "RR.HH.", "Finanz."];
  const rows: { r: string; lv: (keyof typeof NIVEL_STYLE)[] }[] = [
    { r: "Administrativo", lv: ["write", "write", "write", "write"] },
    { r: "Operativo", lv: ["write", "write", "read", "none"] },
    { r: "Rep. Comercial", lv: ["none", "none", "none", "none"] },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="grid grid-cols-[64px_repeat(4,1fr)] sm:grid-cols-[76px_repeat(4,1fr)] bg-muted/50 text-[8px] font-bold uppercase text-muted-foreground">
        <div className="px-2 py-1.5">Rol</div>
        {cols.map((c) => (
          <div key={c} className="px-1 py-1.5 text-center">{c}</div>
        ))}
      </div>
      {rows.map((row, i) => (
        <div key={row.r} className={`grid grid-cols-[64px_repeat(4,1fr)] sm:grid-cols-[76px_repeat(4,1fr)] items-center ${i > 0 ? "border-t border-border" : ""}`}>
          <div className="px-2 py-1.5 text-[9px] font-medium text-foreground truncate">{row.r}</div>
          {row.lv.map((l, j) => (
            <div key={j} className="px-1 py-1.5 flex justify-center">
              <Chip level={l} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MockNiveles() {
  const items: { level: keyof typeof NIVEL_STYLE; d: string }[] = [
    { level: "none", d: "No ve la sección" },
    { level: "read", d: "Puede ver, no editar" },
    { level: "write", d: "Ver, cargar, editar y borrar" },
  ];
  return (
    <div className="space-y-2">
      {items.map((it) => (
        <div key={it.level} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2">
          <Chip level={it.level} className="w-16 shrink-0" />
          <span className="text-[11px] text-muted-foreground">{it.d}</span>
        </div>
      ))}
      <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 w-16 justify-center shrink-0">
          <Crown size={9} /> Total
        </span>
        <span className="text-[11px] text-amber-800">El Administrador ve y edita todo, siempre.</span>
      </div>
    </div>
  );
}

function MockGrupoPaginas() {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg border-2 border-[#0088D1] bg-[#0088D1]/5 px-3 py-2">
        <span className="text-[11px] font-bold text-foreground">Columna “Flota”</span>
        <Chip level="write" />
      </div>
      <div className="flex justify-center"><ArrowRight size={14} className="rotate-90 text-primary" /></div>
      <div className="rounded-lg border border-border divide-y divide-border">
        {["Camiones", "Mantenimiento → Servicios", "Mantenimiento → Costos"].map((p) => (
          <div key={p} className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">{p}</span>
            <Chip level="write" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MockCrearRol() {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
        <div>
          <div className="text-[12px] font-semibold text-foreground">Supervisor de taller</div>
          <span className="text-[9px] text-muted-foreground">2 usuarios</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-primary"><Pencil size={12} /></span>
          <span className="inline-flex size-6 items-center justify-center rounded-md bg-muted text-destructive"><Trash2 size={12} /></span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#0088D1]/40 bg-[#0088D1]/5 px-3 py-2 text-[12px] font-semibold text-primary">
        <Plus size={14} /> Crear rol
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 3 — Confidencial
// ===========================================================================

function MockConfidencial() {
  return (
    <div className="space-y-2.5">
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Rol: Usuario Administrativo</div>
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-[11px] text-foreground">Gastos</span>
          <Chip level="write" />
        </div>
        <div className="flex items-center justify-between px-3 py-2 bg-amber-50/60">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-900">
            <Lock size={11} className="text-amber-600" /> Sueldos
          </span>
          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-700">
            Confidencial
          </span>
        </div>
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2 flex items-start gap-1.5">
        <ShieldCheck size={13} className="text-primary shrink-0 mt-px" />
        <span>Aunque el rol tenga <b>Edición</b>, lo confidencial <b>solo lo ve el Administrador</b>.</span>
      </div>
    </div>
  );
}

function ConfTreeRow({ label, on, indent }: { label: string; on?: boolean; indent?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-1.5 pr-3 ${indent ? "pl-6" : "pl-3"}`}>
      <span className="flex items-center gap-1.5 text-[11px] text-foreground">
        {on ? <Lock size={11} className="text-amber-600" /> : <LockOpen size={11} className="text-muted-foreground/50" />}
        {label}
      </span>
      <span className={`relative h-4 w-7 rounded-full ${on ? "bg-amber-500" : "bg-muted-foreground/30"}`}>
        <span className={`absolute top-0.5 size-3 rounded-full bg-white ${on ? "right-0.5" : "left-0.5"}`} />
      </span>
    </div>
  );
}

function MockConfTree() {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-3 py-1.5 bg-muted/40 border-b border-border flex items-center gap-1.5">
        <span className="size-1.5 rounded-full" style={{ background: "#6366F1" }} />
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#6366F1" }}>Flota</span>
      </div>
      <div className="divide-y divide-border">
        <ConfTreeRow label="Camiones" />
        <div>
          <div className="px-3 py-1 text-[10px] font-semibold text-foreground bg-muted/20">Mantenimiento</div>
          <ConfTreeRow label="Servicios" indent />
          <ConfTreeRow label="Costos rep. y rep." indent />
        </div>
      </div>
    </div>
  );
}

function MockConfEjemplos() {
  const ej = ["Sueldos", "Caja (saldo y caja grande)", "Métricas históricas", "Impuestos", "Préstamos", "Facturación en el dashboard"];
  return (
    <div className="space-y-1.5">
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Lo que conviene tener cerrado</div>
      {ej.map((e) => (
        <div key={e} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-1.5">
          <Lock size={11} className="text-amber-600 shrink-0" />
          <span className="text-[11px] text-amber-900">{e}</span>
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// TAB 4 — Permisos puntuales por usuario
// ===========================================================================

function MockPuntualQueEs() {
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-card px-3 py-2.5">
        <div className="text-[11px] font-semibold text-foreground">Pablo Díaz</div>
        <div className="text-[9px] text-muted-foreground mb-2">Rol: Operativo</div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground">Acceso del rol</span>
          <Chip level="write" />
          <span className="text-muted-foreground/50">+</span>
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700">
            <Plus size={9} /> Edición · Combustible
          </span>
        </div>
      </div>
      <div className="rounded-lg bg-[#F0F9FF] border border-[#BAE6FD] text-[10px] text-[#075985] px-2.5 py-2">
        Un extra <b>solo para esa persona</b>, encima de su rol. <b>Siempre suma, nunca resta.</b>
      </div>
    </div>
  );
}

function MockPuntualForm() {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2">
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Agregar permiso puntual</div>
      <div className="grid grid-cols-2 gap-2">
        <MiniField label="Usuario" value="Pablo Díaz" />
        <MiniField label="Área / sección" value="Combustible" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniField label="Nivel" value="Edición" />
        <MiniField label="Vence" value="30/07/2026" icon={<CalendarClock size={10} />} />
      </div>
      <div className="flex justify-end">
        <div className="h-7 px-3 text-[10px] rounded-md bg-[#0088D1] text-white inline-flex items-center gap-1 font-bold">
          <Plus size={11} /> Agregar
        </div>
      </div>
    </div>
  );
}

function MockVencimiento() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2">
        <Chip level="write" />
        <span className="text-[10px] font-semibold text-foreground">Combustible</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold text-muted-foreground">
          <Lock size={9} /> Permanente
        </span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2">
        <Chip level="read" />
        <span className="text-[10px] font-semibold text-foreground">Finanzas</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold text-amber-700">
          <Clock size={9} /> Vence 30/07
        </span>
      </div>
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 px-2.5 py-2 flex items-center gap-1.5">
        <CalendarClock size={12} /> Al llegar la fecha, el permiso <b>se saca solo</b>. Ideal para reemplazos por licencia.
      </div>
    </div>
  );
}

function MockPuntualLista() {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5 space-y-2">
      <div>
        <span className="text-[11px] font-semibold text-foreground">Nicolás Quiroga</span>
        <span className="text-[9px] text-muted-foreground"> (Usuario Administrativo)</span>
      </div>
      {[
        { a: "Viajes", venc: "Permanente" },
        { a: "Comercial", venc: "Vence 15/08" },
      ].map((p) => (
        <div key={p.a} className="flex items-center gap-1.5 rounded-md border border-emerald-100 bg-emerald-50/60 px-2 py-1.5">
          <Chip level="write" />
          <span className="text-[10px] font-semibold text-foreground">{p.a}</span>
          <span className="text-[9px] text-muted-foreground">· {p.venc}</span>
          <span className="text-[8px] italic text-muted-foreground/70 truncate">“reemplazo”</span>
          <Trash2 size={11} className="ml-auto text-destructive shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// Tabs
// ===========================================================================

const TABS: TutorialTab[] = [
  {
    id: "usuarios",
    label: "Usuarios",
    icon: <UserPlus size={14} />,
    steps: [
      {
        title: "Creá el usuario",
        description:
          "Arriba a la derecha, botón “Nuevo usuario”. Los choferes NO usan el sistema: acá van administración, mantenimiento y dirección.",
        mockup: <MockToolbar />,
      },
      {
        title: "Completá nombre, email y rol",
        description:
          "Nombre, el email con el que va a iniciar sesión, una contraseña temporal y el rol (el rol define su acceso base). Email y contraseña son obligatorios.",
        mockup: <MockNuevoUsuario />,
        hint: "El email es la llave de entrada: tiene que ser uno real de la persona. Si te equivocás, después lo editás.",
      },
      {
        title: "Qué pasa al crearlo",
        description:
          "La cuenta queda activa. La persona entra con su email + la contraseña temporal, y el sistema la obliga a elegir una propia en el primer ingreso.",
        mockup: <MockPrimerIngreso />,
        hint: "Vos nunca ves la contraseña definitiva: la elige la persona. Más seguro para todos.",
      },
      {
        title: "El listado de usuarios",
        description:
          "Todas las personas con acceso: nombre, email, rol, estado y último acceso. Desde el mismo listado le cambiás el rol cuando haga falta.",
        mockup: <MockListado />,
      },
      {
        title: "Editar, resetear, activar y borrar",
        description:
          "Por cada usuario: el lápiz edita nombre/email, la llave manda un link para nueva clave, el switch lo activa o desactiva (inactivo = no entra) y el tacho lo elimina.",
        mockup: <MockAcciones />,
        hint: "Cuando alguien se va de licencia, desactivalo en vez de borrarlo: conservás su historial y lo reactivás cuando vuelve.",
      },
    ],
  },
  {
    id: "roles",
    label: "Roles",
    icon: <ShieldCheck size={14} />,
    steps: [
      {
        title: "La matriz = tu menú lateral",
        description:
          "Filas: los roles. Columnas: los 9 grupos del menú (Principal, Logística, Flota, Seguridad, RR.HH., Comercial, Finanzas, Compliance, Sistema). En cada cruce elegís el nivel.",
        mockup: <MockMatrix />,
      },
      {
        title: "Tres niveles, nada más",
        description:
          "Sin acceso, Lectura o Edición. Edición es control total: ver, cargar, editar y borrar. El Administrador ve todo siempre. Cada acción queda en Auditoría.",
        mockup: <MockNiveles />,
      },
      {
        title: "Un grupo manda sobre sus páginas",
        description:
          "Si un grupo tiene varias páginas adentro (ej. Flota = Camiones + Mantenimiento), el nivel que elegís se aplica a todas juntas.",
        mockup: <MockGrupoPaginas />,
      },
      {
        title: "Crear, renombrar o borrar un rol",
        description:
          "Todo en la misma matriz: la fila “+ Crear rol” agrega uno (arranca sin permisos). Pasando el mouse por el nombre aparecen el lápiz y el tacho. Cada rol muestra cuántos usuarios tiene.",
        mockup: <MockCrearRol />,
        hint: "Un rol con usuarios asignados no se puede borrar: primero reasignás a esa gente a otro rol.",
      },
    ],
  },
  {
    id: "confidencial",
    label: "Confidencial",
    icon: <Lock size={14} />,
    steps: [
      {
        title: "Qué es una sección confidencial",
        description:
          "Queda cerrada para todos salvo el Administrador — aunque el rol tenga Edición. Está por encima de la matriz: el candado gana siempre.",
        mockup: <MockConfidencial />,
      },
      {
        title: "El switch, con forma de sidebar",
        description:
          "En “Secciones confidenciales” está todo ordenado igual que el menú: los 9 grupos de colores, sus páginas y las subsecciones adentro. Prendés el switch y listo.",
        mockup: <MockConfTree />,
        hint: "Ámbar = confidencial (solo admin). Apagado = “según el rol” (lo que diga la matriz).",
      },
      {
        title: "Para qué usarlo",
        description:
          "Para todo lo sensible del negocio. Lo marcás una vez y queda cerrado para siempre, sin importar qué rol tenga cada persona.",
        mockup: <MockConfEjemplos />,
      },
    ],
  },
  {
    id: "puntuales",
    label: "Puntuales",
    icon: <UserCog size={14} />,
    steps: [
      {
        title: "Un permiso extra para UNA persona",
        description:
          "Los “Permisos individuales por usuario” le suman un acceso a alguien puntual, por encima de su rol. Solo suman, nunca restan.",
        mockup: <MockPuntualQueEs />,
        hint: "Sirve cuando una sola persona necesita algo que su rol no tiene, sin cambiarle el rol a todo el grupo.",
      },
      {
        title: "Cómo agregar uno",
        description:
          "En “Agregar permiso puntual”: elegís la persona, el área o sección, el nivel y (opcional) una fecha de vencimiento. Apretás “Agregar”.",
        mockup: <MockPuntualForm />,
      },
      {
        title: "El vencimiento",
        description:
          "Si dejás la fecha vacía, el permiso es permanente. Si le ponés fecha, es temporal: al llegar ese día el permiso se saca solo, sin que tengas que acordarte.",
        mockup: <MockVencimiento />,
        hint: "Perfecto para reemplazos: “dale Finanzas a Fulano hasta el 30/07 mientras Mengana está de licencia”.",
      },
      {
        title: "Ver y quitar los puntuales",
        description:
          "Debajo del formulario ves, por persona, todos sus permisos extra con su motivo y vencimiento. El tacho saca cualquiera al toque.",
        mockup: <MockPuntualLista />,
      },
    ],
  },
];

export default function HelpUsuariosDialog() {
  return <HelpTutorialDialog title="Usuarios y Permisos — guía" tabs={TABS} />;
}
