import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/authz";
import { ApiFailure } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import type { CurrentUser } from "@/lib/types";

export const TOOL_SLUG = "suitescript_migrator";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: string): boolean => UUID_RE.test(v);

export type RunRow = { id: string; user_id: string | null; tool_id: string; status: string };
export type ToolContext = { user: CurrentUser; admin: SupabaseClient; toolId: string };

/** Auth (401) then tool lookup (404 if missing/disabled). Everything after uses the admin client. */
export async function requireToolContext(): Promise<ToolContext> {
  const user = await getCurrentUser();
  if (!user) throw new ApiFailure("unauthorized", "Please sign in to continue.");
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tools")
    .select("id, status")
    .eq("slug", TOOL_SLUG)
    .maybeSingle();
  if (error) throw new ApiFailure("internal", "Something went wrong. Please try again.");
  if (!data || data.status === "disabled") throw new ApiFailure("not_found", "Not found.");
  return { user, admin, toolId: data.id as string };
}

/** Run must exist, belong to this user and to this tool; otherwise 404 (no existence leak). */
export async function loadOwnedRun(ctx: ToolContext, runId: string): Promise<RunRow> {
  if (!isUuid(runId)) throw new ApiFailure("not_found", "Not found.");
  const { data, error } = await ctx.admin
    .from("runs")
    .select("id, user_id, tool_id, status")
    .eq("id", runId)
    .eq("user_id", ctx.user.id)
    .eq("tool_id", ctx.toolId)
    .maybeSingle();
  if (error) throw new ApiFailure("internal", "Something went wrong. Please try again.");
  if (!data) throw new ApiFailure("not_found", "Not found.");
  return data as RunRow;
}
