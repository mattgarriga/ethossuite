import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiFailure } from "@/lib/api";

export const USER_RUNS_PER_HOUR = 3;
export const USER_RUNS_PER_DAY = 10;
export const IP_RUNS_PER_DAY = 20;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type Settings = { dailySpendCapUsd: number; toolsPaused: boolean };

/** 00:00 UTC of the day containing `now`. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** Pure decision for the spend guard. */
export function spendDecision(s: Settings, spentTodayUsd: number): "ok" | "paused" | "daily_cap" {
  if (s.toolsPaused) return "paused";
  if (spentTodayUsd >= s.dailySpendCapUsd) return "daily_cap";
  return "ok";
}

/** Pure decision for rate limits, from already-counted events. */
export function rateLimitExceeded(c: { userHour: number; userDay: number; ipDay: number }): boolean {
  return c.userHour >= USER_RUNS_PER_HOUR || c.userDay >= USER_RUNS_PER_DAY || c.ipDay >= IP_RUNS_PER_DAY;
}

/** First x-forwarded-for entry, then x-real-ip, then "unknown". */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (xff) return xff;
  const real = headers.get("x-real-ip")?.trim();
  return real || "unknown";
}

function salt(): string {
  const configured = process.env.RATE_LIMIT_SALT;
  if (configured) return configured;
  return createHash("sha256").update(process.env.SUPABASE_SECRET_KEY ?? "").digest("hex");
}

/** SHA-256(salt + ip), hex. The raw IP is never stored. */
export function hashIp(ip: string): string {
  return createHash("sha256").update(salt() + ip).digest("hex");
}

export async function getDailySpendUsd(admin: SupabaseClient, now: Date = new Date()): Promise<number> {
  const since = startOfUtcDay(now).toISOString();
  const PAGE = 1000;
  let total = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("usage_costs")
      .select("cost_usd")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new ApiFailure("internal", "Could not check usage limits.");
    for (const row of data ?? []) total += Number(row.cost_usd) || 0;
    if (!data || data.length < PAGE) break;
  }
  return total;
}

export async function getSettings(admin: SupabaseClient): Promise<Settings> {
  const { data, error } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["daily_spend_cap_usd", "tools_paused"]);
  if (error) throw new ApiFailure("internal", "Could not check usage limits.");
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const cap = Number(map.get("daily_spend_cap_usd"));
  const paused = map.get("tools_paused");
  return {
    // Missing or garbled cap fails closed (nothing may be spent).
    dailySpendCapUsd: Number.isFinite(cap) ? cap : 0,
    toolsPaused: paused === true || paused === "true",
  };
}

export async function assertCanSpend(admin: SupabaseClient): Promise<void> {
  const settings = await getSettings(admin);
  const decision = spendDecision(settings, settings.toolsPaused ? 0 : await getDailySpendUsd(admin));
  if (decision === "paused") {
    throw new ApiFailure("paused", "The assessment tool is temporarily unavailable. Please try again later.");
  }
  if (decision === "daily_cap") {
    throw new ApiFailure("daily_cap", "We've reached today's capacity for free assessments. Please try again tomorrow.");
  }
}

async function countEvents(
  admin: SupabaseClient,
  scope: "user" | "ip",
  key: string,
  toolId: string,
  sinceMs: number,
): Promise<number> {
  const { count, error } = await admin
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("scope", scope)
    .eq("key", key)
    .eq("tool_id", toolId)
    .gte("created_at", new Date(Date.now() - sinceMs).toISOString());
  if (error) throw new ApiFailure("internal", "Could not check usage limits.");
  return count ?? 0;
}

/** Checks per-user and per-IP limits; on success records one user and one ip event. */
export async function checkAndRecordRateLimit(
  admin: SupabaseClient,
  p: { userId: string; ipHash: string; toolId: string },
): Promise<void> {
  const [userHour, userDay, ipDay] = await Promise.all([
    countEvents(admin, "user", p.userId, p.toolId, HOUR_MS),
    countEvents(admin, "user", p.userId, p.toolId, DAY_MS),
    countEvents(admin, "ip", p.ipHash, p.toolId, DAY_MS),
  ]);
  if (rateLimitExceeded({ userHour, userDay, ipDay })) {
    throw new ApiFailure("rate_limited", "You've reached the limit for assessments. Please try again later.");
  }
  const { error } = await admin.from("rate_limit_events").insert([
    { scope: "user", key: p.userId, tool_id: p.toolId },
    { scope: "ip", key: p.ipHash, tool_id: p.toolId },
  ]);
  if (error) throw new ApiFailure("internal", "Could not record usage.");
}
