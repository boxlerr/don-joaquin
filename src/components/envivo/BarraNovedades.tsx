"use client";

import { ArrowUp } from "lucide-react";

/**
 * "3 movimientos nuevos · Ver".
 *
 * Aparece cuando llegaron novedades mientras la persona estaba cargando algo.
 * Nada se mueve hasta que la toque: es el patrón de las redes sociales, donde
 * el contador sube solo pero el contenido se queda quieto. La alternativa
 * —refrescar igual— es sacarle la fila de abajo a alguien que está tipeando.
 *
 * Va pegada arriba de la lista (`sticky`) y no flotando en una esquina: tiene
 * que estar donde están los datos que cambiaron, si no nadie la ve.
 */
export default function BarraNovedades({
  cantidad,
  onVer,
  sustantivo = "novedad",
  sustantivoPlural = "novedades",
}: {
  cantidad: number;
  onVer: () => void;
  /** "movimiento", "viaje"… para que el aviso diga de qué habla. */
  sustantivo?: string;
  sustantivoPlural?: string;
}) {
  if (cantidad <= 0) return null;

  const texto =
    cantidad === 1 ? `1 ${sustantivo} nuevo` : `${cantidad} ${sustantivoPlural} nuevas`;

  return (
    <div className="sticky top-0 z-20 flex justify-center py-2">
      <button
        type="button"
        onClick={onVer}
        className="inline-flex items-center gap-2 rounded-full border border-[#0088D1]/30 bg-card px-4 h-9 text-[13px] font-semibold text-[#0277BD] shadow-sm transition-colors hover:bg-[#E1F5FE]"
      >
        <ArrowUp size={14} />
        {texto} · Ver
      </button>
    </div>
  );
}
