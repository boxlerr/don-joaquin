"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { coincideEnAlguno } from "@/lib/texto";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  FileText,
  Wallet,
  Map,
  Pencil,
  Users as UsersIcon,
  Building,
  ClipboardList,
} from "lucide-react";
import NewClienteSheet from "./new-cliente-sheet";
import ImportClientesModal from "./import-clientes-modal";
import DeleteClienteButton from "./delete-cliente-button";
import ReactivateClienteButton from "./reactivate-cliente-button";
import HelpTutorialButton from "./help-tutorial-button";
import EditClienteSheet, { type ClienteEditable } from "./edit-cliente-sheet";
import CuentaTab from "./cuenta-tab";
import ViajesTab from "./viajes-tab";
import ContactosTab from "./contactos-tab";
import SucursalesTab from "./sucursales-tab";
import RequisitosTab from "./requisitos-tab";
import SucursalPrincipalCard from "./sucursal-principal-card";

type EstadoFiltro = "activos" | "inactivos" | "todos";

type Cliente = {
  id: string;
  razon_social: string;
  nombre_comercial: string | null;
  cuit: string | null;
  domicilio_fiscal: string | null;
  localidad: string | null;
  provincia: string | null;
  condicion_iva: string;
  estado: string;
  observaciones: string | null;
  email?: string | null;
  telefono?: string | null;
};

const LETTERS = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

type Tab = "info" | "contactos" | "sucursales" | "requisitos" | "cuenta" | "viajes";

function firstLetter(name: string): string {
  const c = name.trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : "#";
}

export default function ClientesList({
  clientes,
  sucursalesCount,
  canWrite = false,
}: {
  clientes: Cliente[];
  sucursalesCount: Record<string, number>;
  canWrite?: boolean;
}) {
  const [letter, setLetter] = useState<string>("#");
  const [search, setSearch] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("activos");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("info");
  const [editing, setEditing] = useState<ClienteEditable | null>(null);

  const filtered = useMemo(() => {
    return clientes.filter((c) => {
      if (estadoFiltro === "activos" && c.estado !== "activo") return false;
      if (estadoFiltro === "inactivos" && c.estado !== "inactivo") return false;
      if (letter !== "#" && firstLetter(c.razon_social) !== letter) return false;
      return coincideEnAlguno(
        [c.razon_social, c.nombre_comercial, c.cuit, c.localidad],
        search,
      );
    });
  }, [clientes, letter, search, estadoFiltro]);

  const titulo =
    estadoFiltro === "activos"
      ? "Cartera de clientes activos"
      : estadoFiltro === "inactivos"
        ? "Clientes dados de baja"
        : "Todos los clientes";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {LETTERS.map((l) => {
          const active = letter === l;
          return (
            <button
              key={l}
              type="button"
              onClick={() => setLetter(l)}
              className={
                "size-8 rounded-full text-xs font-semibold transition-colors border " +
                (active
                  ? "bg-[#0F172A] text-white border-[#0F172A]"
                  : "bg-card text-muted-foreground border-border hover:bg-muted")
              }
            >
              {l}
            </button>
          );
        })}
      </div>

      <div className="bg-card rounded-[8px] border border-border shadow-sm p-4">
        <div className="flex items-center gap-3 mb-4">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar cliente por nombre..."
            className="flex-1 text-sm"
          />
          <Combobox
            value={estadoFiltro}
            onValueChange={(v) => setEstadoFiltro(v as EstadoFiltro)}
            options={[
              { id: "activos", label: "Activos" },
              { id: "inactivos", label: "Inactivos" },
              { id: "todos", label: "Todos" },
            ]}
            searchable={false}
            triggerClassName="h-9 w-36"
          />
          <HelpTutorialButton />
          {canWrite && <ImportClientesModal />}
          {canWrite && <NewClienteSheet />}
        </div>

        <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase mb-3">
          {titulo}
        </p>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Sin clientes para el filtro seleccionado.
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((c) => {
              const isOpen = expanded === c.id;
              const initial = firstLetter(c.razon_social);
              const inactivo = c.estado === "inactivo";
              return (
                <li
                  key={c.id}
                  className={
                    "rounded-[8px] border bg-card " +
                    (inactivo ? "border-border opacity-70" : "border-border")
                  }
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpanded(isOpen ? null : c.id);
                      setActiveTab("info");
                    }}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors rounded-[8px]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          "size-10 rounded-full font-bold text-sm flex items-center justify-center " +
                          (inactivo
                            ? "bg-muted text-muted-foreground/70"
                            : "bg-[#E1F5FE] text-primary")
                        }
                      >
                        {initial}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-foreground font-semibold text-sm">
                            {c.razon_social}
                          </div>
                          {inactivo && (
                            <span className="text-[10px] font-semibold tracking-wide uppercase bg-muted text-muted-foreground border border-border rounded-full px-2 py-0.5">
                              Inactivo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">
                          <MapPin size={11} className="text-primary" />
                          {c.localidad ?? "Sin localidad"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
                          Identificación
                        </div>
                        <div className="text-foreground text-sm font-mono">
                          {c.cuit ?? "NO DATA"}
                        </div>
                      </div>
                      <span className="size-7 rounded-full bg-[#E1F5FE] text-primary flex items-center justify-center">
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border p-4 bg-muted/40 rounded-b-[8px]">
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <TabButton
                          icon={<FileText size={14} />}
                          label="Información general"
                          active={activeTab === "info"}
                          onClick={() => setActiveTab("info")}
                        />
                        <TabButton
                          icon={<UsersIcon size={14} />}
                          label="Contactos"
                          active={activeTab === "contactos"}
                          onClick={() => setActiveTab("contactos")}
                        />
                        {(sucursalesCount[c.id] ?? 0) >= 2 && (
                          <TabButton
                            icon={<Building size={14} />}
                            label="Sucursales"
                            active={activeTab === "sucursales"}
                            onClick={() => setActiveTab("sucursales")}
                          />
                        )}
                        <TabButton
                          icon={<ClipboardList size={14} />}
                          label="Requisitos"
                          active={activeTab === "requisitos"}
                          onClick={() => setActiveTab("requisitos")}
                        />
                        <TabButton
                          icon={<Wallet size={14} />}
                          label="Estado de cuenta"
                          active={activeTab === "cuenta"}
                          onClick={() => setActiveTab("cuenta")}
                        />
                        <TabButton
                          icon={<Map size={14} />}
                          label="Viajes recientes"
                          active={activeTab === "viajes"}
                          onClick={() => setActiveTab("viajes")}
                        />
                      </div>

                      {activeTab === "info" && (
                        <InfoGeneral
                          cliente={c}
                          totalSucursales={sucursalesCount[c.id] ?? 0}
                          onEdit={() => setEditing(c)}
                        />
                      )}
                      {activeTab === "contactos" && <ContactosTab clienteId={c.id} />}
                      {activeTab === "sucursales" && <SucursalesTab clienteId={c.id} />}
                      {activeTab === "requisitos" && <RequisitosTab clienteId={c.id} />}
                      {activeTab === "cuenta" && <CuentaTab clienteId={c.id} />}
                      {activeTab === "viajes" && <ViajesTab clienteId={c.id} />}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <EditClienteSheet
          cliente={editing}
          open={editing !== null}
          onOpenChange={(v) => !v && setEditing(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-semibold uppercase tracking-wide transition-colors " +
        (active
          ? "bg-[#0088D1] text-white"
          : "bg-card text-muted-foreground border border-border hover:bg-muted")
      }
    >
      {icon}
      {label}
    </button>
  );
}

function InfoGeneral({
  cliente,
  totalSucursales,
  onEdit,
}: {
  cliente: Cliente;
  totalSucursales: number;
  onEdit: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Field label="Firma comercial" value={cliente.nombre_comercial ?? cliente.razon_social} />
        <Field label="CUIT / CUIL" value={cliente.cuit ?? "—"} mono />
        <Field label="Domicilio" value={cliente.domicilio_fiscal ?? "—"} />
        <Field
          label="Ubicación"
          value={[cliente.localidad, cliente.provincia].filter(Boolean).join(", ") || "—"}
        />
      </div>

      <SucursalPrincipalCard clienteId={cliente.id} totalSucursales={totalSucursales} />

      {cliente.observaciones && (
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-[8px] p-3">
          <div className="text-[10px] font-semibold tracking-[0.18em] text-[#92400E] uppercase mb-1">
            Observaciones técnicas
          </div>
          <p className="text-sm text-[#78350F] italic">&ldquo;{cliente.observaciones}&rdquo;</p>
        </div>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold text-primary border border-[#0088D1]/30 hover:bg-[#E1F5FE] transition-colors"
        >
          <Pencil size={12} />
          Editar datos
        </button>
        {cliente.estado === "inactivo" ? (
          <ReactivateClienteButton id={cliente.id} razonSocial={cliente.razon_social} />
        ) : (
          <DeleteClienteButton id={cliente.id} razonSocial={cliente.razon_social} />
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-card border border-border rounded-[8px] p-3">
      <div className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground/70 uppercase">
        {label}
      </div>
      <div className={"text-foreground text-sm font-semibold mt-1 " + (mono ? "font-mono" : "")}>
        {value}
      </div>
    </div>
  );
}

