import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { enlaceActivo, leerChoferesDelEnlace, leerTarifas } from "./datos";
import CargaChoferClient from "./CargaChoferClient";

export const dynamic = "force-dynamic";

/**
 * El gasoil de la vuelta, para el chofer, sin cuenta ni contraseña.
 *
 * Vive fuera del route group del dashboard y fuera del guard de sesión (ver
 * `PUBLIC_PATHS` en lib/supabase/middleware.ts): el chofer no tiene usuario en
 * el sistema y hacerle uno a cada uno de los 61 era exactamente lo que había que
 * evitar. La llave es el token de la URL, que la oficina puede apagar y rotar
 * desde /combustible/autoconsumo.
 *
 * Que sea pública define lo que sale de acá: viajan los nombres de los choferes
 * —para que se elijan— y el cuadro de rindes, nada más. Ni teléfonos, ni DNI, ni
 * una fila de nadie. Y no se indexa: el `robots: noindex` es global (layout raíz)
 * y `robots.txt` cierra el sitio entero.
 */

export const metadata: Metadata = {
  title: "Gasoil de la vuelta — Don Joaquín",
  robots: { index: false, follow: false, nocache: true },
};

export default async function GasoilChoferPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  if (!(await enlaceActivo(supabase, token))) return <EnlaceCaido />;

  const [tarifas, choferes] = await Promise.all([
    leerTarifas(supabase),
    leerChoferesDelEnlace(supabase),
  ]);

  return (
    <main className="mx-auto min-h-full w-full max-w-md bg-white px-5 pb-16 pt-8">
      <Membrete />
      {tarifas.length === 0 || choferes.length === 0 ? (
        <Aviso>
          El sistema todavía no tiene cargado el cuadro de rindes. Avisale a la oficina.
        </Aviso>
      ) : (
        <CargaChoferClient token={token} tarifas={tarifas} choferes={choferes} />
      )}
    </main>
  );
}

function Membrete() {
  return (
    <header className="mb-7">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-horizontal.png" alt="Don Joaquín Transporte" className="h-11 w-auto" />
      <h1 className="mt-5 text-3xl font-bold leading-tight text-slate-900">
        Gasoil de la vuelta
      </h1>
      <p className="mt-1.5 text-lg leading-snug text-slate-500">
        Contestá y te digo cuántos litros podés cargar.
      </p>
    </header>
  );
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-5 text-base text-amber-900">
      {children}
    </p>
  );
}

/**
 * El enlace ya no sirve.
 *
 * No dice "token inválido" ni muestra un 404: el que llegó acá es un chofer que
 * abrió un link viejo guardado en el teléfono, y lo único que necesita saber es
 * qué hacer ahora.
 */
function EnlaceCaido() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center bg-white px-6 py-16 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-horizontal.png"
        alt="Don Joaquín Transporte"
        className="mx-auto h-11 w-auto"
      />
      <h1 className="mt-8 text-2xl font-bold text-slate-900">Este enlace ya no sirve</h1>
      <p className="mt-3 text-lg leading-snug text-slate-500">
        Pedile el nuevo a la oficina y guardalo en el teléfono. El de antes se dio de baja.
      </p>
    </main>
  );
}
