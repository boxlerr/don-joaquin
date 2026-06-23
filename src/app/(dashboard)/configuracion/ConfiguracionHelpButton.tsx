"use client";

import {
  SlidersHorizontal,
  Database,
  PencilLine,
  History,
  Building2,
  FileText,
  Bell,
  Mail,
  MessageCircle,
} from "lucide-react";
import HelpTutorialDialog, { type TutorialTab } from "@/components/help/HelpTutorialDialog";

/** Botón de ayuda de Configuración. Explica cómo editar los parámetros del
 * sistema y qué servicios e integraciones hay disponibles. */
export default function ConfiguracionHelpButton() {
  return <HelpTutorialDialog title="Guía de Configuración" tabs={TABS} />;
}

const TABS: TutorialTab[] = [
  {
    id: "parametros",
    label: "Parámetros",
    icon: <SlidersHorizontal size={14} />,
    steps: [
      {
        title: "Parámetros agrupados por categoría",
        description:
          "Los ajustes del sistema vienen organizados en categorías: Empresa y datos generales, Notificaciones, Seguridad, Liquidación y Tarifas. Cada parámetro tiene su clave, valor y descripción.",
        mockup: <MockCategorias />,
        hint: "Usá el buscador para encontrar un parámetro por su nombre o descripción sin recorrer todas las categorías.",
      },
      {
        title: "Editá uno o toda la categoría",
        description:
          "Con permiso de escritura, editás un parámetro puntual con el lápiz, o usás la edición en bloque para cambiar varios de una categoría a la vez y guardarlos juntos.",
        mockup: <MockEditar />,
      },
      {
        title: "Todo cambio queda en el historial",
        description:
          "Cada parámetro guarda su historial de cambios. Abrilo para ver el valor anterior, el nuevo, quién lo modificó y cuándo. Nada se pierde.",
        mockup: <MockHistorial />,
      },
    ],
  },
  {
    id: "servicios",
    label: "Servicios",
    icon: <Database size={14} />,
    steps: [
      {
        title: "Servicios e integraciones",
        description:
          "Abajo se listan las integraciones que sostienen el sistema: correo (Resend), WhatsApp para alertas, auditoría, documentación, respaldos automáticos y autenticación de Supabase.",
        mockup: <MockServicios />,
      },
      {
        title: "Subsecciones de Configuración",
        description:
          "En el menú lateral, Configuración se abre en: General (esta pantalla), Negocio, Plantillas PDF y Notificaciones, donde ajustás el detalle de cada área.",
        mockup: <MockSubsecciones />,
        hint: "Las Plantillas PDF definen cómo salen impresos los documentos; Notificaciones controla qué alertas se envían y a quién.",
      },
    ],
  },
];

// ============================ Mockups ============================

function MockCategorias() {
  const cats = [
    { Icon: Building2, l: "Empresa y datos generales" },
    { Icon: Bell, l: "Notificaciones" },
    { Icon: SlidersHorizontal, l: "Seguridad" },
  ];
  return (
    <div className="space-y-1.5">
      {cats.map(({ Icon, l }) => (
        <div key={l} className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2">
          <Icon size={14} className="text-primary" />
          <span className="text-[11px] font-semibold text-foreground">{l}</span>
        </div>
      ))}
    </div>
  );
}

function MockEditar() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-bold text-foreground">Notificaciones</span>
        <span className="h-6 px-2 rounded text-[9px] font-semibold bg-[#E1F5FE] text-primary inline-flex items-center gap-1">
          <PencilLine size={10} /> Editar categoría
        </span>
      </div>
      <div className="divide-y divide-border">
        {[
          { k: "Días aviso vencimiento", v: "30" },
          { k: "Email administrador", v: "admin@..." },
        ].map((p) => (
          <div key={p.k} className="px-3 py-2 flex items-center justify-between">
            <div className="text-[10px] text-muted-foreground">{p.k}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-foreground">{p.v}</span>
              <PencilLine size={11} className="text-primary" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockHistorial() {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-3 py-2 border-b border-border flex items-center gap-1.5 text-[11px] font-bold text-foreground">
        <History size={13} className="text-primary" /> Historial del parámetro
      </div>
      <div className="p-3 space-y-2 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">15/06 · M. Gómez</span>
          <span className="flex items-center gap-1.5">
            <span className="line-through text-muted-foreground/70">15</span>
            <span className="text-[#166534] font-semibold">30</span>
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">02/05 · Admin</span>
          <span className="text-foreground font-semibold">15 (inicial)</span>
        </div>
      </div>
    </div>
  );
}

function MockServicios() {
  const svc = [
    { Icon: Mail, l: "Resend (correo)" },
    { Icon: MessageCircle, l: "WhatsApp" },
    { Icon: History, l: "Auditoría" },
    { Icon: Database, l: "Respaldos" },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {svc.map(({ Icon, l }) => (
        <div key={l} className="rounded-lg border border-border bg-card p-2.5 flex items-center gap-2">
          <span className="size-7 rounded-md bg-[#E1F5FE] inline-flex items-center justify-center">
            <Icon size={13} className="text-primary" />
          </span>
          <span className="text-[10px] font-semibold text-foreground">{l}</span>
        </div>
      ))}
    </div>
  );
}

function MockSubsecciones() {
  const subs = [
    { Icon: SlidersHorizontal, l: "General", active: true },
    { Icon: Building2, l: "Negocio" },
    { Icon: FileText, l: "Plantillas PDF" },
    { Icon: Bell, l: "Notificaciones" },
  ];
  return (
    <div className="space-y-1.5">
      {subs.map(({ Icon, l, active }) => (
        <div
          key={l}
          className={
            "rounded-md px-3 py-1.5 flex items-center gap-2 text-[11px] font-semibold " +
            (active ? "bg-[#E1F5FE] text-primary" : "text-muted-foreground")
          }
        >
          <Icon size={13} />
          {l}
        </div>
      ))}
    </div>
  );
}
