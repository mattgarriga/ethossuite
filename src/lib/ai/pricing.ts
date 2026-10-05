import type { TokenUsage } from "@/lib/types";

// USD per million tokens. Claude Haiku 4.5 first-party API rates as of 2026-10:
// input $1, output $5, cache read 0.1x input, 5-minute cache write 1.25x input.
// VERIFY against the live pricing page before switching AI_MODE=live.
export const PRICES_PER_MTOK: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export const ANALYSIS_MODEL = "claude-haiku-4-5";

export function costUsd(model: string, usage: TokenUsage): number {
  const p = PRICES_PER_MTOK[model];
  if (!p) throw new Error(`No pricing for model ${model}`);
  const usd =
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheReadTokens * p.cacheRead +
      usage.cacheCreationTokens * p.cacheWrite) /
    1_000_000;
  // usage_costs.cost_usd is numeric(12,6).
  return Math.round(usd * 1e6) / 1e6;
}
