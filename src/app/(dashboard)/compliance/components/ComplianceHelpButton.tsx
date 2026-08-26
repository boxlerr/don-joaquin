"use client";

import {
  BookOpen,
  Search,
  Upload,
  Wrench,
  Users,
  Truck,
  History,
  Pencil,
  Plus,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ChevronDown,
  ClipboardList,
  ShieldCheck,
  SlidersHorizontal,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  FileX,
  FileText,
} from "lucide-react";
import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";
import MetricCard from "@/components/ui/MetricCard";
import IlustracionCompliance from "./IlustracionCompliance";
import ArteTipoDocumento from "./ArteTipoDocumento";

/**
 * La guía de Compliance.
 *
 * Se reescribió entera el 12/08/2026: la anterior explicaba una pantalla que ya
 * no existe (hablaba de "Cobertura 72% / Vigencia 94%" y de una vista matriz que
 * se sacaron hace meses). Un tutorial desactualizado es peor que no tener
 * ninguno — manda a buscar botones que no están.
 *
 * Dos reglas al escribirla:
 *
 *  - Los dibujos usan los COMPONENTES REALES de la pantalla (`MetricCard`,
 *    `IlustracionCompliance`, los mismos colores de estado). Así el tutorial no
 *    se puede desincronizar del diseño: si mañana cambia la tarjeta, cambia acá
 *    sola. Las réplicas a mano envejecen sin que nadie se entere.
 *  - Se cuenta desde la pantalla y en segunda persona, sin nombres internos.
 *    Quien lo abre no sabe qué es un "requisito" ni un "nivel": sabe que le
 *    falta la VTV de un camión.
 */
export default function ComplianceHelpButton() {
  return <HelpTutorialDialog title="Guía de Compliance" tabs={TABS} />;
}

// Los mismos colores que usa la pantalla, para que el dibujo no invente ninguno.
const ROJO = "#B91C1C";
const AMBAR = "#B45309";
const GRIS = "#475569";
const VERDE = "#166534";

const TABS: TutorialTab[] = [
  // ---------------------------------------------------------------- Entender
  {
    id: "entender",
    label: "Qué estoy viendo",
    icon: <BookOpen size={14} />,
    steps: [
      {
        title: "Para qué sirve esta pantalla",
        description:
          "Es la lista de todos los papeles que la empresa tiene que tener al día: los de la empresa, los de cada camión y los de cada chofer. Por cada uno guarda cuándo vence, y avisa antes de que se venza.",
        mockup: <MockPantalla />,
        hint: "Arriba hay tres solapas. Documentación es la papeleta de flota que piden YPF y Loma; SICOP y Secondi son los organismos donde se presentan trámites aparte.",
      },
      {
        title: "Los cinco números de arriba",
        description:
          "Resumen de cómo viene todo. Y no son sólo números: tocá uno y la pantalla queda filtrada por eso. Tocá “Vencidos” y abajo van a quedar únicamente los vencidos.",
        mockup: <MockMetricas />,
        hint: "La tarjeta que estás mirando queda con un borde azul. Para volver a ver todo, tocá “Total” o “Limpiar filtros”.",
      },
      {
        title: "Los cuatro estados, sin confundirlos",
        description:
          "Cada documento está en uno de cuatro estados. Los dos del medio son los que más se confunden y no son lo mismo.",
        mockup: <MockEstados />,
        hint: "“Sin cargar” quiere decir que no hay ni fecha ni papel — el documento puede existir en un cajón. “Vencido” quiere decir que se cargó y ya caducó. Ojo con una tercera: un documento puede estar al día y aun así no tener el papel subido; eso se ve en el primer ícono de la fila, tachado.",
      },
      {
        title: "“Por vencer” no son 30 días para todos",
        description:
          "Cada tipo de documento tiene su propio aviso previo: los antecedentes avisan con 90 días, el psicofísico con 60, la mayoría con 30. Por eso un documento que vence en 45 días puede aparecer como “por vencer” y otro no.",
        mockup: <MockPreaviso />,
      },
    ],
  },

  // ---------------------------------------------------------------- Encontrar
  {
    id: "encontrar",
    label: "Encontrar algo",
    icon: <Search size={14} />,
    steps: [
      {
        title: "La barra de búsqueda te sigue",
        description:
          "Escribí el nombre de un chofer, una patente o el nombre del documento. Al lado tenés tres listas para acotar: qué tipo de documento, en qué estado y si es de la empresa, de una unidad o de un chofer.",
        mockup: <MockFiltros />,
        hint: "La barra queda pegada arriba mientras bajás: no hace falta volver al principio para cambiar un filtro. En “Más filtros” hay tres cosas menos usadas: a qué plataforma va, si tiene el papel adjunto y qué vence en los próximos 30, 60 o 90 días.",
      },
      {
        title: "Las tarjetas por tipo de documento",
        description:
          "Cada tarjeta es un tipo de papel, con su propio dibujo: la oblea de la VTV, la tarjeta del carnet, el casco de la ART. Dice a quién le corresponde, cuántos hay y qué porcentaje está al día; cómo viene lo cuentan el filete de la izquierda, la barra y el pie.",
        mockup: <MockTarjetasTipo />,
        hint: "Tocá una tarjeta y abajo se abre la lista de a QUIÉN le falta ese papel — primero los vencidos y los que están por vencer. Desde ahí mismo lo cargás.",
      },
      {
        title: "La lista de abajo, por chofer y por unidad",
        description:
          "Debajo está el detalle, en tres tarjetas: Empresa, Unidades y Choferes. Cada una dice cuántos documentos son, qué porcentaje está al día y qué falta, y se abre con «Ver documentos». Adentro hay una ficha por chofer o por camión, con su foto o el logo de la marca.",
        mockup: <MockAgrupado />,
        hint: "Dentro de la ficha de una unidad los papeles vienen separados en dos: los del chasis y los del acoplado, cada uno con su patente — las válvulas de seguridad y el disco de ruptura son de la tolva. Y un alcance que no coincide con el filtro no desaparece: queda apagado y en cero.",
      },
      {
        title: "La columna de la derecha",
        description:
          "Son atajos. “Qué hay que atender” te lleva a lo vencido, lo que está por vencer o lo que falta cargar. “Por dónde entrar” filtra por empresa, unidad o chofer. Y abajo dice desde cuándo son los datos que estás viendo.",
        mockup: <MockRail />,
        hint: "Si alguien cargó algo hace un minuto, tocá “Actualizar ahora” para volver a pedir los datos.",
      },
    ],
  },

  // ------------------------------------------------------------------ Cargar
  {
    id: "cargar",
    label: "Cargar un documento",
    icon: <Wrench size={14} />,
    steps: [
      {
        title: "Lo que falta tiene su botón",
        description:
          "En la lista, todo lo que todavía no se cargó muestra un botón “Cargar”. Tocalo y se abre el formulario ya apuntando a ese documento y a esa persona o camión.",
        mockup: <MockFilaCargar />,
      },
      {
        title: "O cargalo desde arriba, sin buscarlo",
        description:
          "El botón “Agregar documento” de la esquina te deja elegir de dos listas con buscador: qué documento es y de quién. Sirve cuando ya sabés qué tenés en la mano y no querés buscar la fila entre cientos.",
        mockup: <MockAgregar />,
        hint: "Si esa persona ya tenía ese documento cargado, se abre para cambiarle la fecha en vez de crear uno repetido.",
      },
      {
        title: "Lo único obligatorio es el vencimiento",
        description:
          "Con esa fecha el sistema calcula el estado y avisa antes. El papel es opcional: podés anotar el vencimiento ahora y subir el archivo después.",
        mockup: <MockFormulario />,
        hint: "Podés arrastrar el archivo a la caja de la derecha. Las fotos se ven en miniatura y cualquier archivo se abre en una pestaña para revisarlo antes de guardar — el nombre no alcanza cuando todo se llama IMG_4821.jpg.",
      },
      {
        title: "Los tres botones de cada fila",
        description:
          "El primero abre el papel adentro del sistema —no lo descarga ni te saca de la pantalla— y desde ahí lo imprimís o lo bajás. Si aparece tachado y en gris, esa fila tiene la fecha pero nadie subió el documento: tocalo y se abre la ventana para subirlo. El del medio es el historial. El lápiz renueva el vencimiento.",
        mockup: <MockAcciones />,
        hint: "Al renovar, arriba de la caja para subir vas a ver «Lo que ya está cargado», con los papeles guardados y un ojo para mirarlos. Lo viejo no se pierde: queda en el historial, con la fecha y quién lo cargó.",
      },
      {
        title: "Llevártelo en papel o en Excel",
        description:
          "“Exportar” baja a Excel lo que estés viendo, con los filtros puestos. “Imprimir” arma una versión limpia en papel, sin botones ni menús, para presentar a YPF, a Loma o a un organismo.",
        mockup: <MockExportar />,
        hint: "En esa misma barra está “Recorrido”, al lado de este tutorial: en vez de leer, te va señalando cada cosa sobre la pantalla. Y con un filtro puesto aparece “Exportar estos N”, para bajar solamente el recorte que estás mirando.",
      },
    ],
  },
];

// ============================ Dibujos ============================
// Usan los componentes reales de la pantalla: si el diseño cambia, cambian solos.

function Marco({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-border bg-card p-3">{children}</div>;
}

function MockSolapas() {
  const solapas = [
    { l: "Documentación", n: "848", Icono: ClipboardList, activa: true },
    { l: "SICOP", n: "0", Icono: ShieldCheck, activa: false },
    { l: "Secondi", n: "0", Icono: ShieldCheck, activa: false },
  ];
  return (
    <div className="flex items-center gap-1 border-b border-border">
      {solapas.map(({ l, n, Icono, activa }) => (
        <span
          key={l}
          className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[12px] font-semibold ${
            activa ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          }`}
        >
          <Icono size={14} />
          {l}
          <span
            className={`rounded-full px-1.5 text-[10px] font-bold ${
              activa ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            {n}
          </span>
        </span>
      ))}
    </div>
  );
}

/** El esqueleto de la pantalla, para ubicarse antes de entrar en el detalle. */
function MockPantalla() {
  return (
    <div className="space-y-2">
      <MockSolapas />
      <div className="flex gap-1.5">
        {["#22C55E", "#0088D1", "#EF4444", "#F59E0B", "#94A3B8"].map((c) => (
          <div key={c} className="flex-1 rounded-md border border-border bg-card p-1.5">
            <span className="block h-1 w-6 rounded-full" style={{ backgroundColor: c }} />
            <span className="mt-1 block h-2 w-4 rounded-sm bg-muted" />
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <div className="flex-1 space-y-1.5">
          <div className="h-6 rounded-md border border-border bg-card" />
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 rounded-md border border-border bg-card" />
            ))}
          </div>
          <div className="h-14 rounded-md border border-border bg-card" />
        </div>
        <div className="w-16 space-y-1.5">
          <div className="h-12 rounded-md border border-border bg-card" />
          <div className="h-12 rounded-md border border-border bg-card" />
        </div>
      </div>
    </div>
  );
}

function MockMetricas() {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="rounded-[8px] ring-2 ring-primary/40">
        <MetricCard
          art={<IlustracionCompliance nombre="al-dia" size={38} />}
          label="Al día"
          value="113"
          sub="Vigentes"
          icon={CheckCircle2}
          color="#22C55E"
        />
      </div>
      <MetricCard
        art={<IlustracionCompliance nombre="vencido" size={38} />}
        label="Vencidos"
        value="0"
        sub="Ninguno vencido"
        icon={AlertTriangle}
        color="#EF4444"
      />
      <MetricCard
        art={<IlustracionCompliance nombre="por-vencer" size={38} />}
        label="Por vencer"
        value="7"
        sub="Dentro del preaviso"
        icon={CalendarClock}
        color="#F59E0B"
      />
      <MetricCard
        art={<IlustracionCompliance nombre="sin-cargar" size={38} />}
        label="Sin cargar"
        value="728"
        sub="Nunca se presentaron"
        icon={FileX}
        color="#64748B"
      />
    </div>
  );
}

function MockEstados() {
  const filas = [
    { arte: "vencido" as const, l: "Vencido", d: "Se subió y ya caducó. Hay que renovarlo ya.", c: ROJO },
    { arte: "por-vencer" as const, l: "Por vencer", d: "Todavía sirve, pero está dentro del aviso.", c: AMBAR },
    { arte: "sin-cargar" as const, l: "Sin cargar", d: "Nunca se subió al sistema.", c: GRIS },
    { arte: "al-dia" as const, l: "Al día", d: "Cargado y vigente. No hay nada que hacer.", c: VERDE },
  ];
  return (
    <div className="space-y-1.5">
      {filas.map(({ arte, l, d, c }) => (
        <div key={l} className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2">
          <IlustracionCompliance nombre={arte} size={34} />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold" style={{ color: c }}>
              {l}
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">{d}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockPreaviso() {
  const filas = [
    { l: "Antecedentes penales", d: "avisa con 90 días" },
    { l: "Psicofísico", d: "avisa con 60 días" },
    { l: "VTV, licencia y el resto", d: "avisan con 30 días" },
  ];
  return (
    <Marco>
      <div className="space-y-2">
        {filas.map(({ l, d }) => (
          <div key={l} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-[12px] text-foreground">
              <CalendarClock size={14} className="text-muted-foreground" />
              {l}
            </span>
            <span className="shrink-0 text-[11px] font-semibold text-[#B45309]">{d}</span>
          </div>
        ))}
      </div>
    </Marco>
  );
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border border-border bg-card px-2.5 py-1">
      <span className="text-[9px] leading-none text-muted-foreground">{label}</span>
      <span className="truncate text-[12px] font-semibold text-foreground">{valor}</span>
    </div>
  );
}

function MockFiltros() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <div className="flex min-w-0 flex-1 flex-col justify-center rounded-lg border-2 border-[#0088D1] bg-card px-2.5 py-1">
          <span className="text-[9px] leading-none text-muted-foreground">Buscar</span>
          <span className="flex items-center gap-1.5 truncate text-[12px] text-muted-foreground">
            <Search size={12} className="text-primary" />
            Documento, chofer o unidad…
          </span>
        </div>
        <Campo label="Tipo de documento" valor="Todos" />
      </div>
      <div className="flex items-center gap-1.5">
        <Campo label="Estado" valor="Todos" />
        <Campo label="Alcance" valor="Todas" />
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-2 text-[12px] font-medium text-foreground">
          <SlidersHorizontal size={13} />
          Más filtros
        </span>
      </div>
    </div>
  );
}

function MockTarjetasTipo() {
  const tarjetas = [
    { codigo: "VTV", nivel: "unidad" as const, n: "VTV", sub: "Camión · 62", pct: 87, color: "#F59E0B", pie: "5 por vencer · 3 sin cargar", c: AMBAR },
    { codigo: "SEGURO_VIDA", nivel: "chofer" as const, n: "Seguro de vida", sub: "Chofer · 78", pct: 0, color: "#94A3B8", pie: "78 sin cargar", c: GRIS },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {tarjetas.map((t) => (
        <div key={t.n} className="relative overflow-hidden rounded-lg border border-border bg-card p-2.5 pl-3.5">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: t.color }} />
          <div className="flex items-start gap-2">
            <ArteTipoDocumento codigo={t.codigo} nivel={t.nivel} size={30} />
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-foreground">{t.n}</p>
              <p className="truncate text-[10px] text-muted-foreground">{t.sub}</p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full" style={{ width: `${t.pct}%`, backgroundColor: t.color }} />
            </span>
            <span className="text-[11px] font-bold tabular-nums" style={{ color: t.c }}>
              {t.pct}%
            </span>
          </div>
          <p className="mt-1 truncate text-[10px] text-muted-foreground">{t.pie}</p>
        </div>
      ))}
    </div>
  );
}

function MockAgrupado() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="grid size-5 place-items-center rounded-md border border-border bg-card">
          <ChevronDown size={12} />
        </span>
        <Truck size={13} />
        Unidades · uno por cada unidad
        <span className="font-normal text-muted-foreground/70">372</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 bg-muted/30 px-2.5 py-2">
          <span className="grid size-5 place-items-center rounded-md border border-border bg-card">
            <ChevronDown size={11} />
          </span>
          <span className="grid size-7 place-items-center rounded-full border border-border bg-card text-[8px] font-bold text-muted-foreground">
            IVECO
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground">AG821WS</p>
            <p className="truncate text-[10px] text-muted-foreground">Iveco · 2024 · 35 TN</p>
          </div>
          <span className="ml-auto rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2 py-0.5 text-[9px] font-medium text-[#92400E]">
            1 por vencer
          </span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-2">
          <span className="grid size-[18px] place-items-center rounded-[5px] border-[1.5px] border-[#F59E0B] bg-[#FFFBEB]">
            <CheckCircle2 size={11} className="text-[#F59E0B]" />
          </span>
          <span className="text-[11px] font-medium text-foreground">VTV</span>
          <span className="ml-auto text-[10px] text-muted-foreground">vence 28/08/2026</span>
          <span className="rounded-md bg-[#FFFBEB] px-1.5 py-0.5 text-[9px] font-semibold text-[#B45309]">
            Por vencer
          </span>
        </div>
      </div>
    </div>
  );
}

function MockRail() {
  const filas = [
    { arte: "vencido" as const, t: "0 documentos vencidos", s: "Ninguno vencido" },
    { arte: "por-vencer" as const, t: "7 por vencer", s: "Dentro del aviso de cada tipo" },
    { arte: "sin-cargar" as const, t: "728 sin cargar", s: "Nunca se presentaron" },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <p className="border-b border-border px-3 py-2 text-[11px] font-semibold text-foreground">
        Qué hay que atender
      </p>
      {filas.map(({ arte, t, s }) => (
        <div key={t} className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-0">
          <IlustracionCompliance nombre={arte} size={30} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] text-foreground">{t}</p>
            <p className="truncate text-[10px] text-muted-foreground">{s}</p>
          </div>
          <ChevronRight size={13} className="text-muted-foreground/60" />
        </div>
      ))}
    </div>
  );
}

function MockFilaCargar() {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      {[
        { n: "F931", falta: true },
        { n: "Nómina F931", falta: true },
        { n: "Sindicales", falta: true },
        { n: "ART", falta: false },
        { n: "Certificado de Cobertura", falta: false },
      ].map(({ n, falta }) => (
        <div key={n} className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-0">
          <span
            className={`grid size-[18px] place-items-center rounded-[5px] border-[1.5px] ${
              falta ? "border-[#94A3B8]" : "border-[#22C55E] bg-[#F0FDF4]"
            }`}
          >
            {!falta && <CheckCircle2 size={11} className="text-[#22C55E]" />}
          </span>
          <span className="text-[12px] font-medium text-foreground">{n}</span>
          {falta ? (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-[11px] font-semibold text-primary">
              <Upload size={12} />
              Cargar
            </span>
          ) : (
            <>
              <span className="ml-auto text-[10px] text-muted-foreground">vence 31/12/2026</span>
              <span className="rounded-md bg-[#F0FDF4] px-1.5 py-0.5 text-[9px] font-semibold text-[#166534]">
                Al día
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function MockAgregar() {
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#0088D1] px-2.5 py-1.5 text-[11px] font-semibold text-white">
          <Plus size={12} />
          Agregar documento
        </span>
      </div>
      <Marco>
        <p className="text-[11px] font-semibold text-foreground">1. ¿Qué documento?</p>
        <div className="mt-1 flex items-center justify-between rounded-md border border-border px-2 py-1.5 text-[11px] text-foreground">
          Carnet de conducir
          <span className="text-[10px] font-semibold text-[#B45309]">24 pendientes</span>
        </div>
        <p className="mt-2.5 text-[11px] font-semibold text-foreground">2. ¿De qué chofer?</p>
        <div className="mt-1 flex items-center gap-2 rounded-md border border-border px-2 py-1.5 text-[11px] text-muted-foreground">
          <Users size={12} />
          Elegí el chofer…
        </div>
      </Marco>
    </div>
  );
}

function MockFormulario() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <Marco>
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Fechas</p>
        <p className="mt-1.5 text-[11px] font-medium text-foreground">
          Vence el <span className="text-red-400">*</span>
        </p>
        <div className="mt-1 rounded-md border border-border px-2 py-1 text-[11px] text-foreground">
          12/08/2027
        </div>
        <p className="mt-2 text-[11px] font-medium text-foreground">Se emitió el</p>
        <div className="mt-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
          dd/mm/aaaa
        </div>
      </Marco>
      <Marco>
        <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">El papel</p>
        <div className="mt-1.5 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#CBD5E1] px-2 py-3 text-center">
          <Upload size={14} className="text-muted-foreground/70" />
          <span className="text-[10px] font-medium text-foreground">Arrastrá el documento acá</span>
        </div>
        <div className="mt-1.5 flex items-center gap-2 rounded-md border border-border p-1">
          <span className="grid size-7 place-items-center rounded bg-muted text-muted-foreground">
            <FileText size={13} />
          </span>
          <span className="min-w-0 flex-1 truncate text-[10px] text-foreground">carnet-perez.pdf</span>
        </div>
      </Marco>
    </div>
  );
}

function MockAcciones() {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid size-[18px] place-items-center rounded-[5px] border-[1.5px] border-[#22C55E] bg-[#F0FDF4]">
          <CheckCircle2 size={11} className="text-[#22C55E]" />
        </span>
        <span className="text-[12px] font-medium text-foreground">Licencia de conducir</span>
        <span className="ml-auto text-[10px] text-muted-foreground">vence 10/05/2027</span>
        <span className="rounded-md bg-[#F0FDF4] px-1.5 py-0.5 text-[9px] font-semibold text-[#166534]">
          Al día
        </span>
        <span className="grid size-6 place-items-center rounded-md bg-[#E1F5FE] text-primary">
          <FileText size={12} />
        </span>
        <span className="grid size-6 place-items-center rounded-md bg-muted/60 text-muted-foreground">
          <History size={12} />
        </span>
        <span className="grid size-6 place-items-center rounded-md bg-muted/60 text-muted-foreground">
          <Pencil size={12} />
        </span>
      </div>
      {/* La misma fila, pero sin el papel subido: es la diferencia que más se
          pregunta —"está al día pero, ¿está el documento?"— y se ve en el
          primer ícono. */}
      <div className="mt-1.5 flex items-center gap-2.5 border-t border-border pt-1.5">
        <span className="grid size-[18px] place-items-center rounded-[5px] border-[1.5px] border-[#22C55E] bg-[#F0FDF4]">
          <CheckCircle2 size={11} className="text-[#22C55E]" />
        </span>
        <span className="text-[12px] font-medium text-foreground">Seguro del vehículo</span>
        <span className="ml-auto text-[10px] text-muted-foreground">vence 08/03/2027</span>
        <span className="rounded-md bg-[#F0FDF4] px-1.5 py-0.5 text-[9px] font-semibold text-[#166534]">
          Al día
        </span>
        <span className="grid size-6 place-items-center rounded-md text-muted-foreground/35">
          <FileX size={12} />
        </span>
        <span className="grid size-6 place-items-center rounded-md bg-muted/60 text-muted-foreground">
          <History size={12} />
        </span>
        <span className="grid size-6 place-items-center rounded-md bg-muted/60 text-muted-foreground">
          <Pencil size={12} />
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText size={11} /> Abre el papel acá adentro
        </span>
        <span className="flex items-center gap-1">
          <FileX size={11} /> Tachado: falta subir el documento
        </span>
        <span className="flex items-center gap-1">
          <History size={11} /> Las presentaciones anteriores
        </span>
        <span className="flex items-center gap-1">
          <Pencil size={11} /> Renovar el vencimiento
        </span>
      </div>
    </div>
  );
}

function MockExportar() {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground">
        <Printer size={13} />
        Imprimir
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground">
        <FileSpreadsheet size={13} />
        Exportar
      </span>
    </div>
  );
}
