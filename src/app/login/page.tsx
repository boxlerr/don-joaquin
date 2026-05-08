import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Iniciar sesión — Don Joaquín",
};

type SearchParams = Promise<{ redirect_to?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect_to;

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            Don Joaquín
          </h1>
          <p className="text-sm text-neutral-500">
            Plataforma de Gestión Logística
          </p>
        </div>

        <LoginForm redirectTo={redirectTo} />

        <p className="text-center text-xs text-neutral-400">
          Sistema de uso interno — Don Joaquín Hnos. SRL
        </p>
      </div>
    </main>
  );
}
