import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";
import { LoginDecoration } from "@/app/login/login-decoration";

export const metadata: Metadata = {
  title: "Nueva contraseña — Don Joaquín",
};

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen bg-white">
      <LoginDecoration />

      <div className="flex w-full flex-col justify-center px-5 sm:px-8 lg:w-[45%] xl:w-[40%] xl:px-24">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8">
            <h3 className="text-xl font-bold text-[#0088D1] mb-2">Seguridad</h3>
            <h1 className="text-4xl font-extrabold text-[#0F172A] mb-3">
              Nueva contraseña
            </h1>
            <p className="text-sm text-neutral-500 font-medium">
              Elegí una contraseña segura para tu cuenta.
            </p>
          </div>

          <ResetPasswordForm />

          <p className="mt-12 text-center text-[13px] text-neutral-400 font-medium">
            Sistema de uso interno — <span className="text-[#0088D1]">Don Joaquín Hnos. SRL</span>
          </p>
        </div>
      </div>
    </main>
  );
}
