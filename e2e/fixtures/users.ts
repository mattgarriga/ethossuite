import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const hasPublicEnv = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

export const hasAdminEnv = () => hasPublicEnv() && Boolean(process.env.SUPABASE_SECRET_KEY);

export const PUBLIC_ENV_MSG =
  "Skipped: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set (no .env.local).";
export const ADMIN_ENV_MSG =
  "Skipped: Supabase env incl. SUPABASE_SECRET_KEY not set (no .env.local); DB-backed test.";

let admin: SupabaseClient | null = null;
export function adminClient(): SupabaseClient {
  if (!hasAdminEnv()) throw new Error(ADMIN_ENV_MSG);
  admin ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

export type TestUser = { id: string; email: string; password: string; role: "public" | "internal" };

export async function createUser({ role }: { role: "public" | "internal" }): Promise<TestUser> {
  const db = adminClient();
  const email = `qa+${randomBytes(6).toString("hex")}@example.test`;
  const password = `Qa-${randomBytes(12).toString("hex")}`;
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "QA Tester" },
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  const id = data.user.id;
  if (role === "internal") {
    // The profile row is created by a trigger; promote it with the service key.
    const { error: upErr } = await db.from("profiles").update({ role: "internal" }).eq("id", id);
    if (upErr) {
      await deleteUser(id);
      throw new Error(`promote to internal failed: ${upErr.message}`);
    }
  }
  return { id, email, password, role };
}

export async function deleteUser(id: string): Promise<void> {
  const { error } = await adminClient().auth.admin.deleteUser(id);
  if (error) console.error(`deleteUser(${id}) failed: ${error.message}`);
}
