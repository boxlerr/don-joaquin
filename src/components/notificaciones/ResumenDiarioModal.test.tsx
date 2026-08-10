import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ResumenDiarioModal, { RESUMEN_DIARIO_EVENT } from "./ResumenDiarioModal";
import type { ResumenDiario } from "@/lib/resumen-diario";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

/**
 * El pop-up del día aparece solo una vez por jornada. Lo que se prueba acá es la
 * OTRA puerta: el botón "Resumen del día" de la campana, que lo vuelve a abrir a
 * mano. Tiene tres reglas que no se ven en la pantalla y son fáciles de romper
 * sin darse cuenta.
 */

/**
 * Cuatro vencidos a propósito: son los que llenan la tira de letra chica del
 * pie (MAX_URGENTES). Con menos, el cumpleaños también entraba ahí y quedaba
 * escrito dos veces en la pantalla — que es exactamente lo que no se quiere
 * probar acá.
 */
const RESUMEN: ResumenDiario = {
  total: 8,
  vencidos: 4,
  grupos: [
    {
      key: "vencimiento_docs",
      nombre: "Vencimiento de documentación",
      total: 6,
      vencidos: 4,
      atraso: [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4],
      items: [
        {
          id: "a1",
          titulo: "Carnet de conducir — Salto Maximiliano",
          diasRestantes: -30,
          fecha: "2026-07-08",
          entidadId: "doc-1",
          href: "/choferes/salto",
        },
        {
          id: "a2",
          titulo: "Manual de Inducción — Grassi Bruno",
          diasRestantes: -20,
          fecha: "2026-07-18",
          entidadId: "doc-2",
          href: "/choferes/grassi",
        },
        {
          id: "a3",
          titulo: "VTV — AF696CR",
          diasRestantes: -10,
          fecha: "2026-07-28",
          entidadId: "doc-3",
          href: "/camiones/1",
        },
        {
          id: "a4",
          titulo: "Libreta sanitaria — Acosta Pablo",
          diasRestantes: -5,
          fecha: "2026-08-02",
          entidadId: "doc-4",
          href: "/choferes/acosta",
        },
      ],
      restantes: 2,
    },
    {
      key: "rrhh_eventos",
      nombre: "Cumpleaños y aniversarios",
      total: 2,
      vencidos: 0,
      atraso: null,
      items: [
        {
          id: "b1",
          titulo: "Cumpleaños — Bustos Marcelo",
          diasRestantes: 1,
          fecha: "2026-08-08",
          entidadId: "ch-1",
          rol: "chofer",
          href: "/choferes/ch-1",
        },
      ],
      restantes: 1,
    },
  ],
};

/** Los cuatro cumpleaños que ahora entran enteros en la banda. */
const CUATRO_CUMPLES: ResumenDiario = {
  total: 4,
  vencidos: 0,
  grupos: [
    {
      key: "rrhh_eventos",
      nombre: "Cumpleaños y aniversarios",
      total: 4,
      vencidos: 0,
      atraso: null,
      items: [1, 6, 15, 21].map((dias, i) => ({
        id: `c${i}`,
        titulo: `Cumpleaños — Persona ${i}`,
        diasRestantes: dias,
        fecha: "2026-08-08",
        entidadId: `ch-${i}`,
        rol: "chofer",
        href: `/choferes/ch-${i}`,
      })),
      restantes: 0,
    },
  ],
};

const VACIO: ResumenDiario = { total: 0, vencidos: 0, grupos: [] };

/** La misma fecha local que escribe el modal (nunca UTC: ver `hoyLocal`). */
function hoy(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function respuesta(json: ResumenDiario) {
  return { ok: true, json: async () => json };
}

/** El evento que dispara el botón de la campana. */
async function abrirAMano() {
  await act(async () => {
    window.dispatchEvent(new Event(RESUMEN_DIARIO_EVENT));
  });
}

beforeEach(() => {
  localStorage.clear();
  push.mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ResumenDiarioModal — reapertura a pedido", () => {
  it("vuelve a abrirse aunque el día ya se haya mostrado", async () => {
    // El pop-up automático de hoy ya salió y se cerró: sin el botón, ese resumen
    // quedaba perdido hasta mañana.
    localStorage.setItem("dj_resumen_dia_u1", hoy());
    const fetchMock = vi.fn().mockResolvedValue(respuesta(RESUMEN));
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián Boxler" />);
    });

    // Marcado como visto → el automático no pide nada ni se muestra.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();

    await abrirAMano();

    expect(fetchMock).toHaveBeenCalledWith("/api/alertas?mode=diario", expect.anything());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    // La tarjeta muestra el nombre corto ("Documentos") para no caer en tres
    // renglones; el nombre entero queda en el nombre accesible.
    expect(
      screen.getByRole("button", { name: /^Vencimiento de documentación: 4 vencidos de 6$/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Documentos")).toBeInTheDocument();
    // Sólo el nombre: el saludo cambia con la hora del día y el test correría
    // distinto a la mañana que a la tarde.
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(/, Julián/);
  });

  it("con el día limpio abre igual y avisa que no hay nada", async () => {
    // El automático directamente no aparece cuando no hay pendientes. A mano
    // tiene que abrir igual: si no, el botón parece roto.
    localStorage.setItem("dj_resumen_dia_u1", hoy());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(VACIO)));

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    await abrirAMano();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Todo en orden")).toBeInTheDocument();
  });

  it("abrir a mano no marca el día como avisado", async () => {
    // Día que arranca limpio (el automático no marca nada) y a media mañana
    // aparece un vencimiento. Que alguien lo mire a mano no puede cancelar el
    // pop-up automático: todavía no salió.
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respuesta(VACIO)) // el automático, al entrar
      .mockResolvedValueOnce(respuesta(RESUMEN)); // el de a mano, más tarde
    vi.stubGlobal("fetch", fetchMock);

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    expect(screen.queryByRole("dialog")).toBeNull();

    await abrirAMano();

    // La tarjeta muestra el nombre corto ("Documentos") para no caer en tres
    // renglones; el nombre entero queda en el nombre accesible.
    expect(
      screen.getByRole("button", { name: /^Vencimiento de documentación: 4 vencidos de 6$/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Documentos")).toBeInTheDocument();
    expect(localStorage.getItem("dj_resumen_dia_u1")).toBeNull();
  });

  it("muestra el error y deja reintentar si el pedido falla", async () => {
    localStorage.setItem("dj_resumen_dia_u1", hoy());
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    await abrirAMano();

    expect(screen.getByText("No se pudo cargar el resumen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("ResumenDiarioModal — cumpleaños", () => {
  /**
   * La celda de esta categoría daba un número suelto ("4") y el click caía en el
   * listado de legajos, que no habla de fechas. Estas dos pruebas cuidan lo que
   * se arregló: que se lea de QUIÉN y CUÁNDO, y que el renglón lleve a su legajo.
   */
  it("muestra nombre, motivo y fecha de cada persona", async () => {
    localStorage.setItem("dj_resumen_dia_u1", hoy());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(RESUMEN)));

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    await abrirAMano();

    expect(screen.getByText("Bustos Marcelo")).toBeInTheDocument();
    expect(screen.getByText("Cumpleaños")).toBeInTheDocument();
    // "Mañana", no "Vence mañana": un cumpleaños no vence. La fecha sale del
    // `fecha` del aviso, así que el texto no depende del día en que corra el test.
    expect(screen.getByText("Mañana · sáb 8/8")).toBeInTheDocument();
  });

  it("el renglón de la persona lleva a su legajo", async () => {
    localStorage.setItem("dj_resumen_dia_u1", hoy());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(RESUMEN)));

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    await abrirAMano();

    await act(async () => {
      screen.getByText("Bustos Marcelo").closest("button")!.click();
    });

    expect(push).toHaveBeenCalledWith("/choferes/ch-1");
  });

  it("con cuatro cumpleaños los muestra a los cuatro, sin el cartel de '+más'", async () => {
    // El bug: la banda es de dos columnas, el server mandaba tres y el cuarto
    // quedaba afuera con un "+1 más" al lado del casillero vacío donde entraba.
    localStorage.setItem("dj_resumen_dia_u1", hoy());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(CUATRO_CUMPLES)));

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    await abrirAMano();

    for (const i of [0, 1, 2, 3]) {
      expect(screen.getByText(`Persona ${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText(/^\+\d+$/)).toBeNull();
  });

  it("el título de la categoría lleva a los avisos de personal", async () => {
    localStorage.setItem("dj_resumen_dia_u1", hoy());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(RESUMEN)));

    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    await abrirAMano();

    await act(async () => {
      screen.getByText("Cumpleaños y aniversarios").closest("button")!.click();
    });

    // NO a /choferes: el listado de legajos no muestra ninguna fecha.
    expect(push).toHaveBeenCalledWith("/notificaciones?categoria=personal");
  });
});

describe("ResumenDiarioModal — el pie", () => {
  async function abrirConResumen() {
    localStorage.setItem("dj_resumen_dia_u1", hoy());
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(respuesta(RESUMEN)));
    await act(async () => {
      render(<ResumenDiarioModal userId="u1" nombre="Julián" />);
    });
    await abrirAMano();
  }

  /**
   * El costado de "Poné todo al día" eran cuatro botones a los módulos. No
   * agregaban nada —cada renglón ya lleva a su aviso y el pie tiene "Ver
   * todas"— y el detalle vivía en una tira aparte que empujaba el cartel hasta
   * obligar a scrollear. Ahora ese espacio muestra lo más atrasado.
   */
  it("al lado de 'Poné todo al día' va lo más atrasado, no botones a los módulos", async () => {
    await abrirConResumen();

    expect(screen.getByText("Poné todo al día")).toBeInTheDocument();
    // Los renglones del detalle, con el nombre separado del tipo de documento.
    expect(screen.getByText("Acosta Pablo")).toBeInTheDocument();
    expect(screen.getByText("Libreta sanitaria")).toBeInTheDocument();

    for (const boton of [
      "Todas las alertas",
      "Legajos del personal",
      "Papeles de la flota",
      "Compliance",
    ]) {
      expect(screen.queryByText(boton)).toBeNull();
    }
  });

  // Van en tests separados a propósito: tocar cualquiera de los dos NAVEGA y
  // cierra el pop-up, así que después del primer click ya no queda nada que
  // clickear.
  it("el renglón lleva a su aviso", async () => {
    await abrirConResumen();

    await act(async () => {
      screen.getByText("Acosta Pablo").closest("button")!.click();
    });

    expect(push).toHaveBeenCalledWith("/choferes/acosta");
  });

  it("el 'y N más' lleva al listado completo", async () => {
    await abrirConResumen();

    await act(async () => {
      screen.getByText(/^y \d+ .* más$/).closest("button")!.click();
    });

    expect(push).toHaveBeenCalledWith("/notificaciones");
  });
});
