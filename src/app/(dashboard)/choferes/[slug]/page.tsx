"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { getChoferDetailAction } from "./actions";
import type { ChoferDetail } from "./types";
import ChoferHeader from "./ChoferHeader";
import ChoferInfoTab from "./ChoferInfoTab";
import ChoferDocumentosTab from "./ChoferDocumentosTab";
import ChoferViajesTab from "./ChoferViajesTab";
import ChoferCuentaTab from "./ChoferCuentaTab";
import ChoferProductividadTab from "./ChoferProductividadTab";
import ChoferApercibimientosTab from "./ChoferApercibimientosTab";
import ChoferLicenciasTab from "./ChoferLicenciasTab";
import ChoferAusenciasTab from "./ChoferAusenciasTab";
import ChoferVacacionesTab from "./ChoferVacacionesTab";
import ChoferPrestamosTab from "./ChoferPrestamosTab";
import ChoferSueldosTab from "./ChoferSueldosTab";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";

type TabId =
  | "info"
  | "documentos"
  | "viajes"
  | "cuenta"
  | "sueldos"
  | "productividad"
  | "apercibimientos"
  | "licencias"
  | "ausencias"
  | "vacaciones"
  | "prestamos";

const TABS: { id: TabId; label: string }[] = [
  { id: "info", label: "Información General" },
  { id: "documentos", label: "Documentación" },
  { id: "viajes", label: "Historial Viajes" },
  { id: "cuenta", label: "Cuenta Corriente" },
  { id: "sueldos", label: "Sueldos" }, // confidencial: solo con can_ver_sueldos
  { id: "productividad", label: "Productividad" },
  { id: "apercibimientos", label: "Apercibimientos" },
  { id: "licencias", label: "Licencias Médicas" },
  { id: "ausencias", label: "Ausencias" },
  { id: "vacaciones", label: "Vacaciones" },
  { id: "prestamos", label: "Préstamos" },
];

export default function ChoferDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slugOrId = params.slug as string;

  const [chofer, setChofer] = useState<ChoferDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  // La barra de secciones scrollea: si se entra con ?tab=prestamos la sección
  // quedaba seleccionada pero fuera de la vista y había que buscarla a mano.
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});

  const [editingInfo, setEditingInfo] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get("tab") as TabId | null;
    if (tabParam && TABS.some((t) => t.id === tabParam)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getChoferDetailAction(slugOrId);
    setChofer(data);
    setLoading(false);
  }, [slugOrId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincronización intencional al cambiar props/abrir (carga o reset de estado)
    loadData();
  }, [loadData]);

  // Si se abrió en pestaña nueva (ej. desde el importador de YPF) no hay historial
  // para "atrás": en ese caso vamos al listado de legajos.
  const volver = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/choferes");
  }, [router]);

  // La pestaña Sueldos es confidencial: si llegó por ?tab=sueldos sin permiso
  // (deep-link), caemos a Información para no dejar el panel en blanco.
  const effectiveTab: TabId =
    activeTab === "sueldos" && chofer && !chofer.can_ver_sueldos ? "info" : activeTab;

  // Centra la sección activa en la barra al cambiarla o al entrar por URL: con
  // ?tab=vacaciones quedaba seleccionada pero fuera de la vista y había que
  // buscarla con la flechita.
  useEffect(() => {
    tabRefs.current[effectiveTab]?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [effectiveTab, loading]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 size={36} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!chofer) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground mb-4">Chofer no encontrado.</p>
        <Button variant="outline" size="sm" onClick={volver}>
          <ArrowLeft size={14} className="mr-1.5" />
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <Button
        variant="outline"
        size="sm"
        onClick={volver}
        className="border-border text-muted-foreground hover:bg-muted/40"
      >
        <ArrowLeft size={14} className="mr-1.5" />
        Volver
      </Button>

      <ChoferHeader
        chofer={chofer}
        onRefresh={loadData}
        onSelectTab={setActiveTab}
        editing={editingInfo}
        onEditar={() => {
          setActiveTab("info");
          setEditingInfo(true);
        }}
      />

      <div className="bg-card rounded-[8px] border border-border shadow-sm overflow-hidden">
        {/* La barra de secciones se leía flotando sobre el contenido: fondo casi
            del mismo tono, texto chico y la sección activa marcada nada más que
            con una línea. Ahora la activa toma el fondo de la tarjeta —queda
            pegada a lo que muestra abajo— y el resto va sobre gris. */}
        <div className="border-b border-border bg-muted/50">
          <HorizontalScrollHint className="px-4" fadeBg="from-muted/50">
            <div className="flex items-end gap-0.5">
              {TABS.filter((tab) => tab.id !== "sueldos" || chofer.can_ver_sueldos).map((tab) => (
                <button
                  key={tab.id}
                  ref={(el) => {
                    tabRefs.current[tab.id] = el;
                  }}
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px whitespace-nowrap rounded-t-[6px] border-b-2 px-4 py-3 text-[15px] transition-colors ${
                    effectiveTab === tab.id
                      ? "border-[#0088D1] bg-card font-semibold text-foreground"
                      : "border-transparent font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </HorizontalScrollHint>
        </div>

        <div className="p-6 bg-card min-h-[50vh]">
          {effectiveTab === "info" && (
            <ChoferInfoTab
              key={chofer.updated_at}
              chofer={chofer}
              onSaved={loadData}
              editing={editingInfo}
              onEditingChange={setEditingInfo}
            />
          )}
          {effectiveTab === "documentos" && (
            <ChoferDocumentosTab chofer={chofer} onRefresh={loadData} />
          )}
          {effectiveTab === "viajes" && <ChoferViajesTab viajes={chofer.viajes_recientes} />}
          {effectiveTab === "cuenta" && <ChoferCuentaTab movimientos={chofer.movimientos_mes} />}
          {effectiveTab === "sueldos" && chofer.can_ver_sueldos && (
            <ChoferSueldosTab chofer_id={chofer.id} />
          )}
          {effectiveTab === "productividad" && (
            <ChoferProductividadTab
              kpis={chofer.productividad_kpis}
              historial={chofer.camiones_historial}
              adelantos={chofer.adelantos_mes}
              evolucion={chofer.evolucion_6meses}
              roturas={chofer.roturas_detalle}
              pesos={chofer.pesos_score}
              is_admin={chofer.is_admin}
              can_ver_sueldos={chofer.can_ver_sueldos}
              onRefresh={loadData}
            />
          )}
          {effectiveTab === "apercibimientos" && (
            <ChoferApercibimientosTab
              chofer_id={chofer.id}
              apercibimientos={chofer.apercibimientos}
              categorias={chofer.categorias_apercibimiento}
              can_write={chofer.can_logistica_write}
              onRefresh={loadData}
            />
          )}
          {effectiveTab === "licencias" && (
            <ChoferLicenciasTab
              chofer_id={chofer.id}
              licencias={chofer.licencias_medicas}
              can_write={chofer.can_logistica_write}
              onRefresh={loadData}
            />
          )}
          {effectiveTab === "ausencias" && (
            <ChoferAusenciasTab
              chofer_id={chofer.id}
              ausencias={chofer.ausencias}
              can_write={chofer.can_logistica_write}
              onRefresh={loadData}
            />
          )}
          {effectiveTab === "vacaciones" && (
            <ChoferVacacionesTab
              chofer_id={chofer.id}
              saldo={chofer.vacaciones}
              ausencias={chofer.ausencias}
              can_write={chofer.can_logistica_write}
              fecha_ingreso={chofer.fecha_ingreso}
              onRefresh={loadData}
            />
          )}
          {effectiveTab === "prestamos" && (
            <ChoferPrestamosTab
              chofer_id={chofer.id}
              prestamos={chofer.prestamos}
              can_write={chofer.can_logistica_write}
              onRefresh={loadData}
            />
          )}
        </div>
      </div>
    </div>
  );
}
