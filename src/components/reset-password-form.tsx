"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/login/actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);

  return (
    <form
      action={action}
      className="w-full max-w-md space-y-4 rounded-card border border-line border-t-4 border-t-blue bg-card p-6 sm:p-8"
    >
      <h1 className="text-2xl font-bold text-navy">Choose a new password</h1>
      {state?.error && (
        <p role="alert" className="rounded-field border border-red bg-redbg p-3 text-sm text-red">
          {state.error}
        </p>
      )}
      <label className="block text-sm font-bold text-navy">
        New password (at least 10 characters)
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="mt-1 block w-full rounded-field border border-line bg-white px-3 py-2 font-normal text-ink focus-visible:border-blue2"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full rounded-full px-4 py-2.5 font-bold transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
