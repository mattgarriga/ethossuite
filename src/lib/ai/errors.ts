export type AnalysisErrorCode =
  | "rate_limited"
  | "timeout"
  | "auth"
  | "bad_request"
  | "refusal"
  | "truncated"
  | "no_output"
  | "upstream"
  | "config"
  | "mock_failure";

/** Thrown by any Analyzer. The message is always safe to show to a user. */
export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  constructor(code: AnalysisErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AnalysisError";
    this.code = code;
  }
}
