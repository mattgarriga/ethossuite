import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { Analyzer, AnalyzeResult } from "@/lib/types";
import { ANALYSIS_MODEL } from "@/lib/ai/pricing";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { AnalyzeOutputSchema } from "@/lib/ai/schema";
import { AnalysisError } from "@/lib/ai/errors";

/** Make a file name safe to use inside an XML-ish attribute. */
export function escapeAttr(value: string): string {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 255);
}

export function buildUserMessage(fileName: string, source: string): string {
  return `<file name="${escapeAttr(fileName)}">\n${source}\n</file>`;
}

function mapSdkError(err: unknown): AnalysisError {
  if (err instanceof AnalysisError) return err;
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new AnalysisError("timeout", "The analysis service timed out.", { cause: err });
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new AnalysisError("rate_limited", "The analysis service is busy. Try again shortly.", { cause: err });
  }
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new AnalysisError("auth", "The analysis service is not configured correctly.", { cause: err });
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new AnalysisError("bad_request", "The analysis request was rejected.", { cause: err });
  }
  if (err instanceof Anthropic.APIError || err instanceof Anthropic.APIConnectionError) {
    return new AnalysisError("upstream", "The analysis service is temporarily unavailable.", { cause: err });
  }
  return new AnalysisError("no_output", "The analysis could not be completed.", { cause: err });
}

export class AnthropicAnalyzer implements Analyzer {
  readonly mode = "live" as const;
  private readonly client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey) throw new AnalysisError("config", "ANTHROPIC_API_KEY is required for live analysis.");
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 60_000 });
  }

  async analyze(input: { fileName: string; source: string }): Promise<AnalyzeResult> {
    try {
      const res = await this.client.messages.parse({
        model: ANALYSIS_MODEL,
        max_tokens: 4000,
        system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: buildUserMessage(input.fileName, input.source) }],
        output_config: { format: zodOutputFormat(AnalyzeOutputSchema) },
      });

      if (res.stop_reason === "refusal") {
        throw new AnalysisError("refusal", "The analysis service declined to analyze this file.");
      }
      if (res.stop_reason === "max_tokens") {
        throw new AnalysisError("truncated", "The analysis was too long to complete for this file.");
      }
      if (!res.parsed_output) {
        throw new AnalysisError("no_output", "The analysis returned no structured result.");
      }

      return {
        output: res.parsed_output,
        model: ANALYSIS_MODEL,
        usage: {
          inputTokens: res.usage.input_tokens,
          outputTokens: res.usage.output_tokens,
          cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
          cacheCreationTokens: res.usage.cache_creation_input_tokens ?? 0,
        },
      };
    } catch (err) {
      throw mapSdkError(err);
    }
  }
}
