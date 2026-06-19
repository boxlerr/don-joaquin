import Link from "next/link";
import PageHeader from "@/components/layout/PageHeader";
import { Palmtree, CalendarRange, ChevronRight } from "lucide-react";
import { requireArea } from "@/lib/auth";
import { getVacacionesGlobal, type VacacionesPeriodo } from "./lib";
import { choferSlug } from "@/lib/chofer-slug";

const SEMANAS = 10;

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Lunes de la semana de `d` (semana arranca lunes). */
function lunesDe(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtDiaMes(d: Date): string {
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function fmtFecha(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

export default async function VacacionesPage() {
  await requireArea("logistica", "read");
  const { saldos, periodos } = await getVacacionesGlobal();

  // --- Ventana de semanas para el cronograma --------------------------------
  const inicioVentana = lunesDe(new Date());
  const semanas = Array.from({ length: SEMANAS }, (_, i) => {
    const start = new Date(inicioVentana);
    start.setDate(start.getDate() + i * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start: toISO(start), end: toISO(end), labelInicio: fmtDiaMes(start) };
  });
  const finVentanaISO = semanas[semanas.length - 1].end;
  const inicioVentanaISO = semanas[0].start;

  // Choferes con al menos un período que solapa la ventana → filas del cronograma.
  const periodosEnVentana = periodos.filter(
    (p) => p.fecha_inicio <= finVentanaISO && p.fecha_fin >= inicioVentanaISO,
  );
  const choferIdsCrono = [...new Set(periodosEnVentana.map((p) => p.chofer_id))];
  const filasCrono = choferIdsCrono.map((id) => {
    const ps = periodosEnVentana.filter((p) => p.chofer_id === id);
    const info = ps[0];
    const celdas = semanas.map((s) => ps.some((p) => p.fecha_inicio <= s.end && p.fecha_fin >= s.start));
    return { id, nombre: info.nombre, apellido: info.apellido, celdas, periodos: ps };
  });
  filasCrono.sort((a, b) => a.apellido.localeCompare(b.apellido));

  const enVacacionesAhora = saldos.filter((s) => s.en_vacaciones_ahora);

  // Saldos: primero los que están de vacaciones ahora, luego por disponibles asc.
  const saldosOrdenados = [...saldos].sort((a, b) => {
    if (a.en_vacaciones_ahora !== b.en_vacaciones_ahora) return a.en_vacaciones_ahora ? -1 : 1;
    if (a.disponibles !== b.disponibles) return a.disponibles - b.disponibles;
    return a.apellido.localeCompare(b.apellido);
  });

  return (
    <div className="p-8 space-y-6 w-full">
      <PageHeader title="Vacaciones" description="Cronograma semanal y saldos de vacaciones por chofer" />

      {/* De vacaciones ahora */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none px-5 py-4">
        <div className="flex items-center gap-2 mb-2">
          <Palmtree size={16} className="text-[#10B981]" />
          <h2 className="text-sm font-bold text-foreground">De vacaciones ahora</h2>
          <span className="text-xs font-semibold text-muted-foreground">({enVacacionesAhora.length})</span>
        </div>
        {enVacacionesAhora.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ningún chofer está de vacaciones hoy.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {enVacacionesAhora.map((s) => (
              <Link
                key={s.chofer_id}
                href={`/choferes/${choferSlug(s)}?tab=vacaciones`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#ECFDF5] dark:bg-emerald-950/30 text-[#065F46] dark:text-emerald-300 border border-[#A7F3D0] dark:border-emerald-800/40 hover:bg-[#D1FAE5] transition-colors"
              >
                <Palmtree size={11} />
                {s.apellido}, {s.nombre}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Cronograma semanal */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
          <CalendarRange size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Cronograma · próximas {SEMANAS} semanas</h2>
        </div>
        {filasCrono.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">
            No hay vacaciones programadas en las próximas {SEMANAS} semanas.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/40">
                  <th className="sticky left-0 z-10 bg-muted/40 text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide min-w-[12rem]">
                    Chofer
                  </th>
                  {semanas.map((s, i) => (
                    <th
                      key={s.start}
                      className={`px-1.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                        i === 0 ? "text-primary" : "text-muted-foreground/70"
                      }`}
                    >
                      {s.labelInicio}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasCrono.map((f) => (
                  <tr key={f.id} className="border-t border-border hover:bg-muted/20">
                    <td className="sticky left-0 z-10 bg-card px-4 py-2 text-sm">
                      <Link
                        href={`/choferes/${choferSlug(f)}?tab=vacaciones`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {f.apellido}, {f.nombre}
                      </Link>
                    </td>
                    {f.celdas.map((activa, i) => (
                      <td key={i} className="px-1 py-2">
                        <div
                          className={`h-5 rounded-[3px] ${
                            activa ? "bg-[#10B981]/80 dark:bg-emerald-500/70" : "bg-transparent"
                          }`}
                          title={activa ? "De vacaciones esta semana" : ""}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
              <span className="inline-block w-3 h-3 rounded-[3px] bg-[#10B981]/80" />
              Semana con vacaciones · la primera columna es la semana en curso
            </div>
          </div>
        )}
      </div>

      {/* Próximos períodos cargados */}
      {periodosEnVentana.length > 0 && <ProximosPeriodos periodos={periodosEnVentana} />}

      {/* Saldos por chofer */}
      <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Palmtree size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Saldos por chofer</h2>
          </div>
          <span className="text-xs text-muted-foreground">{saldosOrdenados.length} choferes activos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                {["Chofer", "Corresponden", "Adeudados", "Tomados", "Disponibles"].map((c, i) => (
                  <th
                    key={c}
                    className={`px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide ${
                      i === 0 ? "text-left" : "text-right"
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {saldosOrdenados.map((s) => (
                <tr key={s.chofer_id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/choferes/${choferSlug(s)}?tab=vacaciones`}
                      className="font-medium text-foreground hover:text-primary inline-flex items-center gap-1.5"
                    >
                      {s.apellido}, {s.nombre}
                      {s.en_vacaciones_ahora && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                          Ahora
                        </span>
                      )}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{s.corresponden}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{s.adeudados}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-[#92400E] dark:text-amber-300">{s.tomados}</td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono font-semibold ${
                      s.disponibles < 0
                        ? "text-[#EF4444]"
                        : s.disponibles === 0
                          ? "text-muted-foreground"
                          : "text-[#10B981]"
                    }`}
                  >
                    {s.disponibles}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProximosPeriodos({ periodos }: { periodos: VacacionesPeriodo[] }) {
  return (
    <div className="bg-card rounded-[8px] border border-border shadow-sm dark:shadow-none overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
        <CalendarRange size={16} className="text-primary" />
        <h2 className="text-sm font-bold text-foreground">Períodos en la ventana</h2>
        <span className="text-xs text-muted-foreground">({periodos.length})</span>
      </div>
      <ul className="divide-y divide-border">
        {periodos.map((p, i) => (
          <li key={`${p.chofer_id}-${i}`} className="flex items-center justify-between gap-3 px-5 py-2.5 hover:bg-muted/20">
            <span className="text-sm font-medium text-foreground">
              {p.apellido}, {p.nombre}
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              {fmtFecha(p.fecha_inicio)} <ChevronRight size={12} /> {fmtFecha(p.fecha_fin)}
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]">
                {p.dias} día{p.dias !== 1 ? "s" : ""}
              </span>
              {p.en_curso && (
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFFBEB] text-[#92400E] border border-[#FEF3C7]">
                  En curso
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
