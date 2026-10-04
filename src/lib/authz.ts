import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser } from "@/lib/types";

export type { CurrentUser, Role } from "@/lib/types";

// One lookup per request, shared by the header and the page.
// Returns null when signed out. Uses auth.getUser() (server-verified) and the
// user's own profiles row (RLS allows self-read), never the admin client.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, full_name, company_name")
    .eq("id", user.id)
    .maybeSingle();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? null,
    // Missing profile row (or any unexpected value) is treated as public.
    role: profile?.role === "internal" ? "internal" : "public",
    fullName: profile?.full_name ?? null,
    companyName: profile?.company_name ?? null,
  };
});

export async function isInternal(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "internal";
}

export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(safeNext(next))}`);
  return user;
}

// 404 (not 403/redirect) for signed-out and non-internal users so /admin isn't discoverable.
export async function requireInternal(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "internal") notFound();
  return user;
}
