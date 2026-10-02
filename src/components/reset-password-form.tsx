"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/login/actions";

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, null);

  return (
    <form action={action} className="w-full max-w-md space-y-4 rounded-lg border border-line bg-white p-8">
      <h1 className="text-2xl font-bold text-navy">Choose a new password</h1>
      {state?.error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {state.error}
        </p>
      )}
      <label className="block text-sm font-semibold text-navy">
        New password (at least 10 characters)
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="mt-1 block w-full rounded-md border border-line px-3 py-2 text-neutral-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-navy px-4 py-2.5 font-semibold text-white transition-colors hover:bg-accent disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save password"}
      </button>
    </form>
  );
}
