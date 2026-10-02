"use server";

import { redirect } from "next/navigation";
import { getOrigin, MIN_PASSWORD_LENGTH, safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | null;

const str = (fd: FormData, key: string, max = 200) =>
  String(fd.get(key) ?? "").trim().slice(0, max);

const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function signIn(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  if (!validEmail(email) || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Please confirm your email first. Check your inbox for the link we sent." };
    }
    return { error: "Incorrect email or password." };
  }
  redirect(safeNext(fd.get("next")));
}

export async function signUp(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  const password = String(fd.get("password") ?? "");
  const fullName = str(fd, "full_name", 100);
  const companyName = str(fd, "company_name", 150);

  if (!fullName) return { error: "Enter your name." };
  if (!validEmail(email)) return { error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, company_name: companyName || null },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(fd.get("next")))}`,
    },
  });
  if (error) return { error: "We couldn't create that account. Please try again." };

  // Same message whether or not the address already existed, so this form
  // can't be used to discover who has an account.
  return { message: "Check your email for a confirmation link to finish creating your account." };
}

export async function sendMagicLink(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  if (!validEmail(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const origin = await getOrigin();
  // shouldCreateUser: false keeps new accounts on the signup form, which collects the name.
  await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(safeNext(fd.get("next")))}`,
    },
  });
  return { message: "If that email has an account, we sent a sign-in link to it." };
}

export async function sendPasswordReset(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = str(fd, "email");
  if (!validEmail(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const origin = await getOrigin();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/auth/reset`,
  });
  return { message: "If that email has an account, we sent a password reset link to it." };
}

export async function updatePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const password = String(fd.get("password") ?? "");
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "We couldn't update your password. Please try again." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
