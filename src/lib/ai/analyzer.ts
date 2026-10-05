import "server-only";
import type { Analyzer, AnalyzeResult } from "@/lib/types";
import { AnalysisError } from "@/lib/ai/errors";
import { MockAnalyzer } from "@/lib/ai/mock";

export { AnalysisError } from "@/lib/ai/errors";

export function resolveAiMode(env: NodeJS.ProcessEnv = process.env): "mock" | "live" {
  const raw = env.AI_MODE?.trim();
  if (!raw || raw === "mock") return "mock";
  if (raw === "live") return "live";
  throw new AnalysisError("config", `Invalid AI_MODE "${raw}". Use "mock" or "live".`);
}

/** Live analyzer that loads the SDK-backed implementation on first use, keeping getAnalyzer() synchronous. */
class LazyLiveAnalyzer implements Analyzer {
  readonly mode = "live" as const;
  private inner: Promise<Analyzer> | null = null;
  constructor(private readonly apiKey: string) {}

  async analyze(input: { fileName: string; source: string }): Promise<AnalyzeResult> {
    this.inner ??= import("@/lib/ai/anthropic").then((m) => new m.AnthropicAnalyzer(this.apiKey));
    return (await this.inner).analyze(input);
  }
}

/**
 * The only way callers obtain an Analyzer. Mock by default; live requires AI_MODE=live
 * AND ANTHROPIC_API_KEY (throws otherwise). The SDK is imported dynamically and only on
 * the first live analyze() call, so the mock path never loads or constructs a client.
 */
export function getAnalyzer(env: NodeJS.ProcessEnv = process.env): Analyzer {
  if (resolveAiMode(env) === "mock") return new MockAnalyzer();
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AnalysisError("config", "AI_MODE=live requires ANTHROPIC_API_KEY to be set.");
  }
  return new LazyLiveAnalyzer(apiKey);
}
