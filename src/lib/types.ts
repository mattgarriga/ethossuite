// Shared contract between front-end and back-end code.

export type Role = "public" | "internal";

export type CurrentUser = {
  id: string;
  email: string | null;
  role: Role;
  fullName: string | null;
  companyName: string | null;
};

// ---------------------------------------------------------------------------
// SuiteScript Migrator (Tool 1)
// ---------------------------------------------------------------------------

export type Severity = "Critical" | "High" | "Medium" | "Low";

/** Detected from source by deterministic rules, never by the model. */
export type ApiVersion = "1.0" | "2.0" | "2.1" | "unknown";

/** Mirrors ANALYZE_SCHEMA in reference/suitescript-2.1-migrator/src/schemas.ts. */
export type AnalyzeOutput = {
  scriptType: string | null;
  entryPoints: string[];
  apiCalls: { name: string; count: number; targetModule: string | null; mapped: boolean }[];
  objectUsage: { name: string; count: number; targetModule: string | null; mapped: boolean }[];
  requiredModules: { module: string; importName: string; reason?: string }[];
  breakingChanges: { change: string; impact?: string; severity: Severity }[];
  unmappedApis: { name: string; workaround?: string }[];
  /** 7-21 point matrix; each factor scores 1, 2 or 3. */
  complexityScore: {
    lineCount?: number;
    nlapiCalls?: number;
    subrecordUsage?: number;
    dateTimeOps?: number;
    recoveryPoints?: number;
    customModules?: number;
    sublistOps?: number;
    total: number;
  };
  complexityRating: Severity;
  testingFocus: string[];
  migrationChecklist: string[];
  purposeDeterminable: boolean;
  purposeSummary: string | null;
  purposeNote: string | null;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

export type AnalyzeResult = { output: AnalyzeOutput; usage: TokenUsage; model: string };

export interface Analyzer {
  readonly mode: "mock" | "live";
  analyze(input: { fileName: string; source: string }): Promise<AnalyzeResult>;
}

// HTTP contract: /api/tools/suitescript-migrator/...
// All error responses: { error: { code: ApiErrorCode; message: string } }
export type ApiErrorCode =
  | "unauthorized"
  | "not_found"
  | "paused"
  | "daily_cap"
  | "rate_limited"
  | "invalid_file"
  | "too_many_files"
  | "run_not_open"
  | "analysis_failed"
  | "internal";

export type ApiError = { error: { code: ApiErrorCode; message: string } };

/** POST /api/tools/suitescript-migrator/runs  -> 201 */
export type CreateRunResponse = { runId: string; maxFiles: number; maxFileBytes: number };

/** POST /api/tools/suitescript-migrator/runs/[runId]/files (multipart, field "file") -> 200 */
export type FileResultResponse = {
  findingId: string;
  fileName: string;
  status: "completed" | "failed";
  apiVersion: ApiVersion;
  complexityRating: Severity | null;
  deadline: { release: string; label: string; approxDate: string };
};

/** POST /api/tools/suitescript-migrator/runs/[runId]/finalize -> 200 */
export type FinalizeResponse = {
  assessmentId: string;
  overallRisk: Severity | null;
  fileCount: number;
};
