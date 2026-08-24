import { describe, it, expect } from "vitest";
import {
  destinoDeMovimiento,
  etiquetaTipo,
  resolverCategoria,
  textoCategoria,
} from "./caja-tipos";

describe("resolverCategoria", () => {
  it("reconoce una categoría de la lista aunque se escriba distinto", () => {
    // Escribir lo mismo que dice el desplegable no puede terminar en una fila
    // "Otro" con el texto repetido al lado.
    expect(resolverCategoria("Cobro a cliente", "ingreso")).toEqual({
      categoria: "cobro_cliente",
      categoriaLibre: null,
    });
    expect(resolverCategoria("cobro a CLIENTE", "ingreso").categoria).toBe("cobro_cliente");
    expect(resolverCategoria("Rendicion / vuelto", "ingreso").categoria).toBe("rendicion_vuelto");
  });

  it("distingue el ajuste positivo del negativo por el lado en que se carga", () => {
    expect(resolverCategoria("Ajuste positivo", "ingreso")).toEqual({
      categoria: "ajuste",
      categoriaLibre: null,
    });
    expect(resolverCategoria("Ajuste negativo", "egreso")).toEqual({
      categoria: "ajuste",
      categoriaLibre: null,
    });
  });

  it("guarda lo escrito TAL CUAL cuando no es ninguna de la lista", () => {
    expect(resolverCategoria("  Venta de chatarra ", "ingreso")).toEqual({
      categoria: "otro",
      categoriaLibre: "Venta de chatarra",
    });
  });

  it("sin texto queda en Otro y sin categoría escrita", () => {
    expect(resolverCategoria("   ", "egreso")).toEqual({
      categoria: "otro",
      categoriaLibre: null,
    });
  });
});

describe("etiquetaTipo", () => {
  it("lo escrito a mano le gana al tipo de gasto y a la categoría", () => {
    expect(
      etiquetaTipo({
        categoria: "otro",
        categoria_libre: "Venta de chatarra",
        tipo_gasto_nombre: "Varios",
      }),
    ).toBe("Venta de chatarra");
  });

  it("sin categoría escrita manda el tipo de gasto", () => {
    expect(etiquetaTipo({ categoria: "pago_proveedor", tipo_gasto_nombre: "Cubiertas" })).toBe(
      "Cubiertas",
    );
  });

  it("y si no hay nada, el nombre de la categoría", () => {
    expect(etiquetaTipo({ categoria: "cobro_cliente" })).toBe("Cobro a cliente");
  });
});

describe("textoCategoria", () => {
  it("devuelve el rótulo del lado en que se está cargando", () => {
    expect(textoCategoria("ajuste", null, "ingreso")).toBe("Ajuste positivo");
    expect(textoCategoria("ajuste", null, "egreso")).toBe("Ajuste negativo");
  });

  it("y lo escrito a mano cuando lo hay", () => {
    expect(textoCategoria("otro", "Venta de chatarra", "ingreso")).toBe("Venta de chatarra");
  });
});

describe("destinoDeMovimiento", () => {
  it("lo atado a un viaje abre ese viaje en el listado", () => {
    const d = destinoDeMovimiento({
      categoria: "cobro_cliente",
      viaje_id: "v1",
      viaje_codigo: "V-1234",
      cliente_id: "c1",
    });
    expect(d?.href).toBe("/viajes?q=V-1234");
    expect(d?.requiereSeccion).toBe("viajes_listado");
  });

  it("la ficha concreta le gana a la categoría", () => {
    // Un pago a chofer con el chofer identificado tiene que abrir SU legajo, no
    // la lista de legajos.
    const d = destinoDeMovimiento({
      categoria: "pago_chofer",
      chofer_id: "ch1",
      chofer_slug: "perez-juan",
    });
    expect(d?.href).toBe("/choferes/perez-juan");
  });

  it("un egreso con tipo de gasto abre Gastos con esa fila ya filtrada", () => {
    // Es donde está el MISMO egreso con su detalle (tipo, camión, comprobante).
    // A Mantenimiento no: esa pantalla lista services, no gastos, y el atajo
    // caería en una lista donde este egreso no aparece.
    const d = destinoDeMovimiento({
      categoria: "pago_proveedor",
      concepto: "Faro delantero AG556LU",
      gasto_id: "g1",
      tipo_gasto_nombre: "Repuestos",
      tipo_gasto_categoria: "mantenimiento",
    });
    expect(d?.href).toBe("/caja/gastos?q=Faro%20delantero%20AG556LU");
    expect(d?.requiereSeccion).toBe("gastos");
  });

  it("una carga de gasoil sí abre Combustible, que es donde está la carga", () => {
    const d = destinoDeMovimiento({
      categoria: "gasto_operativo",
      carga_combustible_id: "cc1",
    });
    expect(d?.href).toBe("/combustible");
    // Combustible es un área entera, no una subsección.
    expect(d?.requiereSeccion).toBeUndefined();
  });

  it("un service abre Mantenimiento", () => {
    const d = destinoDeMovimiento({ categoria: "pago_proveedor", mantenimiento_id: "m1" });
    expect(d?.href).toBe("/mantenimiento");
    expect(d?.requiereSeccion).toBe("mantenimiento_servicios");
  });

  it("un ajuste o un movimiento suelto no lleva a ningún lado", () => {
    // Es a propósito: un link que vuelve a la misma pantalla enseña que las
    // filas "a veces" no hacen nada.
    expect(destinoDeMovimiento({ categoria: "ajuste" })).toBeNull();
    expect(destinoDeMovimiento({ categoria: "otro", categoria_libre: "Venta de chatarra" })).toBeNull();
  });

  it("un viaje sin código abre el listado igual", () => {
    expect(destinoDeMovimiento({ categoria: "otro", viaje_id: "v9" })?.href).toBe("/viajes");
  });
});
