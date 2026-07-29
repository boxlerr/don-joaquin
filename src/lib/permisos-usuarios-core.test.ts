import { describe, it, expect } from "vitest";
import {
  mapaOverridesVigentes,
  resolverNivelSeccion,
  resolverUsuariosConSeccion,
  type ResolverInput,
} from "./permisos-usuarios-core";
import type { AreaNivel } from "./permisos-nivel";

// Espejo de la configuración real: rol admin con área caja en write, el resto
// sin caja, y caja_saldo confidencial (solo dirección).
const ROL_ADMIN = "rol-admin";
const ROL_ADM = "rol-administrativo";
const ROL_OPERATIVO = "rol-operativo";

const BARBARA = "u-barbara"; // admin
const NICO = "u-nico"; // administrativo + override de caja_saldo
const PAULA = "u-paula"; // administrativo, sin caja_saldo
const LUCAS = "u-lucas"; // operativo, sin caja_saldo

function input(over: Partial<ResolverInput> = {}): ResolverInput {
  return {
    usuarios: [
      { id: BARBARA, rol_id: ROL_ADMIN },
      { id: NICO, rol_id: ROL_ADM },
      { id: PAULA, rol_id: ROL_ADM },
      { id: LUCAS, rol_id: ROL_OPERATIVO },
    ],
    rolCodigo: new Map([
      [ROL_ADMIN, "admin"],
      [ROL_ADM, "administrativo"],
      [ROL_OPERATIVO, "operativo"],
    ]),
    esConfidencial: true,
    nivelPorRolSeccion: new Map(),
    nivelPorRolArea: new Map<string, AreaNivel>([[ROL_ADMIN, "write"]]),
    extraArea: new Map(),
    extraSeccion: new Map<string, AreaNivel>([[NICO, "write"]]),
    ...over,
  };
}

describe("resolverNivelSeccion — subsección confidencial (caja_saldo)", () => {
  it("da todo al rol admin", () => {
    expect(resolverNivelSeccion(input(), BARBARA)).toBe("admin");
  });

  it("cierra la sección a quien no la tiene otorgada", () => {
    expect(resolverNivelSeccion(input(), PAULA)).toBe("none");
    expect(resolverNivelSeccion(input(), LUCAS)).toBe("none");
  });

  it("abre la sección con un override por usuario", () => {
    expect(resolverNivelSeccion(input(), NICO)).toBe("write");
  });

  it("no la abre con el área sola: confidencial exige otorgarla", () => {
    const nivel = resolverNivelSeccion(
      input({ extraArea: new Map<string, AreaNivel>([[PAULA, "write"]]) }),
      PAULA,
    );
    expect(nivel).toBe("none");
  });

  it("la otorga por rol cuando existe rol_secciones", () => {
    const nivel = resolverNivelSeccion(
      input({ nivelPorRolSeccion: new Map<string, AreaNivel>([[ROL_ADM, "read"]]) }),
      PAULA,
    );
    expect(nivel).toBe("read");
  });

  it("desmarcada como confidencial, hereda el nivel del área", () => {
    const nivel = resolverNivelSeccion(
      input({
        esConfidencial: false,
        nivelPorRolArea: new Map<string, AreaNivel>([
          [ROL_ADMIN, "write"],
          [ROL_ADM, "write"],
        ]),
      }),
      PAULA,
    );
    expect(nivel).toBe("write");
  });

  it("no confidencial: el override de rol solo restringe, nunca supera al área", () => {
    const base = input({
      esConfidencial: false,
      nivelPorRolArea: new Map<string, AreaNivel>([[ROL_ADM, "read"]]),
    });
    expect(
      resolverNivelSeccion(
        { ...base, nivelPorRolSeccion: new Map<string, AreaNivel>([[ROL_ADM, "admin"]]) },
        PAULA,
      ),
    ).toBe("read");
    expect(
      resolverNivelSeccion(
        { ...base, nivelPorRolSeccion: new Map<string, AreaNivel>([[ROL_ADM, "none"]]) },
        PAULA,
      ),
    ).toBe("none");
  });
});

describe("resolverUsuariosConSeccion — quién es 'dirección' en la caja", () => {
  it("son dirección los admin y quien tenga caja_saldo otorgado", () => {
    const direccion = resolverUsuariosConSeccion(input(), "read");
    expect([...direccion].sort()).toEqual([BARBARA, NICO].sort());
  });

  it("los operadores quedan afuera: sus movimientos siguen visibles", () => {
    const direccion = resolverUsuariosConSeccion(input(), "read");
    expect(direccion.has(PAULA)).toBe(false);
    expect(direccion.has(LUCAS)).toBe(false);
  });

  it("respeta minNivel: con read otorgado no alcanza para write", () => {
    const conRead = input({ extraSeccion: new Map<string, AreaNivel>([[NICO, "read"]]) });
    expect(resolverUsuariosConSeccion(conRead, "read").has(NICO)).toBe(true);
    expect(resolverUsuariosConSeccion(conRead, "write").has(NICO)).toBe(false);
  });
});

describe("mapaOverridesVigentes", () => {
  const AHORA = new Date("2026-07-29T12:00:00Z").getTime();

  it("ignora los vencidos y conserva los permanentes", () => {
    const map = mapaOverridesVigentes(
      [
        { usuario_id: "a", nivel: "write", vence_en: null },
        { usuario_id: "b", nivel: "write", vence_en: "2026-07-28T12:00:00Z" },
        { usuario_id: "c", nivel: "read", vence_en: "2026-08-30T12:00:00Z" },
      ],
      AHORA,
    );
    expect(map.get("a")).toBe("write");
    expect(map.has("b")).toBe(false);
    expect(map.get("c")).toBe("read");
  });
});
