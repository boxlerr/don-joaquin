import Image from "next/image";
import { inicialesBanco, marcaBanco } from "@/lib/bancos";

/**
 * El banco, con su logo cuando lo hay.
 *
 * En una lista de 45 cheques con 16 bancos, los nombres se leen todos iguales
 * —empiezan con "Banco" y siguen— y hay que leer la palabra entera para saber
 * cuál es. El logo lo contesta antes de leer.
 *
 * **Los logos son wordmarks y por eso van solos, sin el nombre al lado.** Los
 * SVG del catálogo son horizontales, de 3:1 a 5:1, y ya traen escrito el nombre
 * de la entidad. Metidos en un cuadradito de 20px quedaban en una rayita de
 * cuatro píxeles, y repetir "Banco Galicia" al lado de un logo que dice "Banco
 * Galicia" es decir dos veces lo mismo. Se dibujan a su proporción real, con el
 * alto fijo en 20px para que la columna no se desordene: por debajo de eso, un
 * wordmark de 5:1 deja las letras en seis píxeles y no se lee ninguno.
 *
 * El que no tiene logo lleva su monograma de color y el nombre en texto: el
 * catálogo es el mismo que usa Préstamos (`lib/bancos`), así que un banco no
 * puede verse de dos formas distintas en dos pantallas.
 */
export default function BancoChip({
  nombre,
  className = "",
}: {
  nombre: string | null | undefined;
  className?: string;
}) {
  const limpio = nombre?.trim();
  if (!limpio) return <span className={className}>—</span>;

  const { logo, color } = marcaBanco(limpio);

  if (logo) {
    return (
      <span className={`inline-flex min-w-0 items-center ${className}`} title={limpio}>
        <Image
          src={logo}
          alt={limpio}
          width={160}
          height={40}
          className="h-5 w-auto max-w-[104px] object-contain object-left"
        />
      </span>
    );
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-2 ${className}`}>
      <span
        className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded px-1 text-[9px] font-bold leading-none tracking-tight text-white"
        style={{ backgroundColor: color }}
        aria-hidden
      >
        {inicialesBanco(limpio)}
      </span>
      <span className="truncate">{limpio}</span>
    </span>
  );
}
