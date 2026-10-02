"use client";

import { useActionState, useState, type ReactNode } from "react";
import {
  sendMagicLink,
  sendPasswordReset,
  signIn,
  signUp,
  type FormState,
} from "@/app/login/actions";

type Mode = "signin" | "signup" | "magic" | "forgot";

const TITLES: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create your account",
  magic: "Email me a sign-in link",
  forgot: "Reset your password",
};

const input =
  "mt-1 block w-full rounded-md border border-line px-3 py-2 text-neutral-900 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
const button =
  "w-full rounded-md bg-navy px-4 py-2.5 font-semibold text-white transition-colors hover:bg-accent disabled:opacity-60";
const linkButton = "font-semibold text-accent hover:underline";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-navy">
      {label}
      {children}
    </label>
  );
}

function Status({ state }: { state: FormState }) {
  if (state?.error) {
    return (
      <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
        {state.error}
      </p>
    );
  }
  if (state?.message) {
    return (
      <p role="status" className="rounded-md border border-accent bg-blue-50 p-3 text-sm text-navy">
        {state.message}
      </p>
    );
  }
  return null;
}

export function AuthForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInAction, signInPending] = useActionState(signIn, null);
  const [signUpState, signUpAction, signUpPending] = useActionState(signUp, null);
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, null);
  const [forgotState, forgotAction, forgotPending] = useActionState(sendPasswordReset, null);

  const linkError: FormState = initialError ? { error: initialError } : null;

  return (
    <div className="w-full max-w-md rounded-lg border border-line bg-white p-8">
      <h1 className="text-2xl font-bold text-navy">{TITLES[mode]}</h1>

      {mode === "signin" && (
        <form action={signInAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <Status state={signInState ?? linkError} />
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required className={input} />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={input}
            />
          </Field>
          <button type="submit" disabled={signInPending} className={button}>
            {signInPending ? "Signing in…" : "Sign in"}
          </button>
          <div className="flex justify-between text-sm">
            <button type="button" onClick={() => setMode("forgot")} className={linkButton}>
              Forgot password?
            </button>
            <button type="button" onClick={() => setMode("magic")} className={linkButton}>
              Email me a link instead
            </button>
          </div>
          <p className="border-t border-line pt-4 text-sm text-neutral-700">
            New here?{" "}
            <button type="button" onClick={() => setMode("signup")} className={linkButton}>
              Create an account
            </button>
          </p>
        </form>
      )}

      {mode === "signup" && (
        <form action={signUpAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <Status state={signUpState} />
          <Field label="Full name">
            <input name="full_name" autoComplete="name" required maxLength={100} className={input} />
          </Field>
          <Field label="Company (optional)">
            <input
              name="company_name"
              autoComplete="organization"
              maxLength={150}
              className={input}
            />
          </Field>
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required className={input} />
          </Field>
          <Field label="Password (at least 10 characters)">
            <input
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              className={input}
            />
          </Field>
          <button type="submit" disabled={signUpPending} className={button}>
            {signUpPending ? "Creating account…" : "Create account"}
          </button>
          <p className="text-sm text-neutral-700">
            Already have an account?{" "}
            <button type="button" onClick={() => setMode("signin")} className={linkButton}>
              Sign in
            </button>
          </p>
        </form>
      )}

      {mode === "magic" && (
        <form action={magicAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <Status state={magicState} />
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required className={input} />
          </Field>
          <button type="submit" disabled={magicPending} className={button}>
            {magicPending ? "Sending…" : "Send sign-in link"}
          </button>
          <button type="button" onClick={() => setMode("signin")} className={linkButton}>
            Back to sign in
          </button>
        </form>
      )}

      {mode === "forgot" && (
        <form action={forgotAction} className="mt-6 space-y-4">
          <Status state={forgotState} />
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required className={input} />
          </Field>
          <button type="submit" disabled={forgotPending} className={button}>
            {forgotPending ? "Sending…" : "Send reset link"}
          </button>
          <button type="button" onClick={() => setMode("signin")} className={linkButton}>
            Back to sign in
          </button>
        </form>
      )}
    </div>
  );
}
