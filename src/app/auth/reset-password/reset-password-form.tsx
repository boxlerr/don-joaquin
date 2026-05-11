"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resetPasswordAction, type ResetPasswordState } from "./actions";
import { Eye, EyeOff } from "lucide-react";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    null,
  );
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-[13px] font-semibold text-neutral-600">
          Nueva contraseña
        </label>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            disabled={pending}
            placeholder="••••••••"
            className={`pr-10 h-11 rounded-lg border-neutral-200 focus:border-[#0088D1] focus:ring-[#0088D1]/20 bg-transparent text-[14px] ${!showPassword && "tracking-widest font-bold"}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="confirm" className="text-[13px] font-semibold text-neutral-600">
          Confirmar contraseña
        </label>
        <div className="relative">
          <Input
            id="confirm"
            name="confirm"
            type={showConfirm ? "text" : "password"}
            autoComplete="new-password"
            required
            disabled={pending}
            placeholder="••••••••"
            className={`pr-10 h-11 rounded-lg border-neutral-200 focus:border-[#0088D1] focus:ring-[#0088D1]/20 bg-transparent text-[14px] ${!showConfirm && "tracking-widest font-bold"}`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {state?.error && (
        <div
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        disabled={pending}
        className="w-full h-11 bg-[#0088D1] hover:bg-[#0077B6] text-white text-[15px] font-semibold rounded-lg shadow-sm transition-all"
      >
        {pending ? "Guardando…" : "Cambiar contraseña"}
      </Button>
    </form>
  );
}
