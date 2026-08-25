import { marcaDeBanco } from "@/lib/bancos-marca";

/**
 * El banco con su monograma de color adelante.
 *
 * En una lista de 45 cheques con 16 bancos distintos, los nombres se leen todos
 * iguales —empiezan con "Banco" y siguen— y hay que leer la palabra entera para
 * saber cuál es. El color lo contesta antes de leer.
 *
 * El cuadradito crece con la sigla: BBVA e ICBC llevan cuatro letras y en un
 * cuadrado fijo quedaban ilegibles.
 */
export default function BancoChip({
  nombre,
  className = "",
}: {
  nombre: string | null | undefined;
  className?: string;
}) {
  const { sigla, color } = marcaDeBanco(nombre);

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <span
        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[9px] font-bold leading-none tracking-tight text-white"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {sigla}
      </span>
      <span className="truncate">{nombre?.trim() || "—"}</span>
    </span>
  );
}
