"use client";

// "Guardado reciente" — el desplegable de la derecha del encabezado.
//
// Guarda combinaciones de filtros con nombre ("Choferes con vencidos", "Taller
// sin teléfono") para no volver a armarlas a mano, y además recuerda cómo
// quedó la pantalla la última vez que se usó.
//
// Ojo con "reciente": es una foto tomada AL ENTRAR, no un espejo de lo que hay
// puesto ahora. Si se actualizara en vivo, el ítem aplicaría los filtros que ya
// están puestos y no serviría para nada; así "Guardado reciente" significa
// "volvé a como lo tenías", que es lo único que puede significar.

import { useEffect, useState } from "react";
import { Bookmark, ChevronDown, History, Save, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hayFiltros, normalizarFiltros, type EstadoFiltros } from "../filtros";

const KEY_GUARDADAS = "dj:legajos:busquedas";
const KEY_RECIENTE = "dj:legajos:reciente";

export type Busqueda = { nombre: string; filtros: EstadoFiltros };

function leer<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Un localStorage con basura (o bloqueado) no puede tirar abajo la pantalla.
    return null;
  }
}

export default function BusquedasGuardadas({
  filtros,
  onAplicar,
}: {
  filtros: EstadoFiltros;
  onAplicar: (f: EstadoFiltros) => void;
}) {
  const [guardadas, setGuardadas] = useState<Busqueda[]>([]);
  const [reciente, setReciente] = useState<EstadoFiltros | null>(null);
  const [dialogo, setDialogo] = useState(false);
  const [nombre, setNombre] = useState("");

  useEffect(() => {
    // localStorage no existe en el server: se lee después de montar, una sola
    // vez, o la hidratación no coincidiría con lo que renderizó Next.
    /* eslint-disable react-hooks/set-state-in-effect -- lectura de preferencias guardadas al montar */
    // `normalizarFiltros` en TODO lo que vuelve del storage: una entrada guardada
    // con la forma de otra versión entraba tal cual al estado y volteaba la
    // pantalla entera al leerle `.rapidos.length`.
    const crudas = leer<Busqueda[]>(KEY_GUARDADAS) ?? [];
    setGuardadas(
      (Array.isArray(crudas) ? crudas : [])
        .filter((g) => g && typeof g.nombre === "string")
        .map((g) => ({ nombre: g.nombre, filtros: normalizarFiltros(g.filtros) })),
    );
    const previo = normalizarFiltros(leer<unknown>(KEY_RECIENTE));
    // Sólo se ofrece si tenía algo puesto: restaurar "ningún filtro" no es
    // restaurar nada.
    if (hayFiltros(previo)) setReciente(previo);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Se persiste lo que hay puesto, para la próxima vez.
  //
  // El guard es "que haya algo que guardar" y NO un contador de renders: los
  // `useRef` sobreviven al doble montaje de StrictMode, así que un guard de
  // primer-render dejaba pasar la segunda vuelta y pisaba la foto de la sesión
  // anterior con el estado vacío del arranque.
  useEffect(() => {
    if (!hayFiltros(filtros)) return;
    try {
      window.localStorage.setItem(KEY_RECIENTE, JSON.stringify(filtros));
    } catch {
      /* sin espacio o en modo privado: no pasa nada, es una comodidad */
    }
  }, [filtros]);

  const persistir = (lista: Busqueda[]) => {
    setGuardadas(lista);
    try {
      window.localStorage.setItem(KEY_GUARDADAS, JSON.stringify(lista));
    } catch {
      /* idem */
    }
  };

  const guardar = () => {
    const n = nombre.trim();
    if (!n) return;
    // Mismo nombre, se pisa: dos "Vencidos" distintos no se distinguen después.
    persistir([...guardadas.filter((g) => g.nombre !== n), { nombre: n, filtros }]);
    setNombre("");
    setDialogo(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              // El nombre accesible tiene que contener el texto visible (WCAG 2.5.3),
              // que es lo que usa el control por voz.
              aria-label="Guardado reciente"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Bookmark size={14} className="text-muted-foreground" />
              <span className="hidden sm:inline">Guardado reciente</span>
              <span className="sm:hidden">Guardados</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-[260px]">
          <DropdownMenuItem
            disabled={!reciente}
            onClick={() => reciente && onAplicar(reciente)}
          >
            <History size={14} />
            <span className="flex-1">Como lo tenías la última vez</span>
          </DropdownMenuItem>

          {guardadas.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Búsquedas guardadas
              </DropdownMenuLabel>
              {guardadas.map((g) => (
                <DropdownMenuItem key={g.nombre} onClick={() => onAplicar(g.filtros)}>
                  <Bookmark size={14} />
                  <span className="flex-1 truncate">{g.nombre}</span>
                </DropdownMenuItem>
              ))}
            </>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hayFiltros(filtros)}
            onClick={() => {
              setNombre("");
              setDialogo(true);
            }}
          >
            <Save size={14} />
            <span className="flex-1">Guardar esta búsqueda…</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guardar esta búsqueda</DialogTitle>
            <DialogDescription>
              Se guarda en este navegador: el área, el estado, el orden, lo que
              escribiste y los filtros avanzados.
            </DialogDescription>
          </DialogHeader>

          <Input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                guardar();
              }
            }}
            placeholder="Ej.: Choferes con documentos vencidos"
          />

          {guardadas.length > 0 && (
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ya guardadas
              </p>
              <ul className="max-h-40 space-y-1 overflow-y-auto">
                {guardadas.map((g) => (
                  <li
                    key={g.nombre}
                    className="flex items-center justify-between gap-2 rounded-[6px] border border-border px-2.5 py-1.5 text-sm"
                  >
                    <span className="truncate">{g.nombre}</span>
                    <button
                      type="button"
                      onClick={() =>
                        persistir(guardadas.filter((x) => x.nombre !== g.nombre))
                      }
                      aria-label={`Eliminar "${g.nombre}"`}
                      className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button variant="brand" disabled={!nombre.trim()} onClick={guardar}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
