import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { LoginDecoration } from "./login-decoration";

export const metadata: Metadata = {
  title: "Iniciar sesión — Don Joaquín",
};

type SearchParams = Promise<{ redirect_to?: string; reset?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect_to;
  const resetSuccess = params.reset === "success";

  return (
    <main className="flex min-h-screen bg-white">
      <LoginDecoration />

      {/* Mitad Derecha: Formulario */}
      <div className="flex w-full flex-col justify-center px-8 lg:w-[45%] xl:w-[40%] xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Títulos */}
          <div className="mb-8">
            <h3 className="text-xl font-bold text-[#0088D1] mb-2">Bienvenido</h3>
            <h1 className="text-4xl font-extrabold text-[#0F172A] mb-3">
              Iniciar Sesión
            </h1>
            <p className="text-sm text-neutral-500 font-medium">
              Ingresa tus credenciales para acceder al sistema.
            </p>
          </div>

          {resetSuccess && (
            <div className="mb-6 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Contraseña actualizada correctamente. Ya podés iniciar sesión.
            </div>
          )}

          <LoginForm redirectTo={redirectTo} />

          <p className="mt-12 text-center text-[13px] text-neutral-400 font-medium">
            Sistema de uso interno — <span className="text-[#0088D1]">Don Joaquín Hnos. SRL</span>
          </p>
        </div>
      </div>
    </main>
  );
}
