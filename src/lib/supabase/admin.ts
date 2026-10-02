import "server-only";
import { createClient } from "@supabase/supabase-js";

// Service-role client. Bypasses RLS, so it is the only path for writes.
// `server-only` makes the build fail if this is ever imported from client code.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
