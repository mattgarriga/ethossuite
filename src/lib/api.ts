import type { ApiError, ApiErrorCode } from "@/lib/types";

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  not_found: 404,
  paused: 503,
  daily_cap: 503,
  rate_limited: 429,
  invalid_file: 400,
  too_many_files: 400,
  run_not_open: 409,
  analysis_failed: 502,
  internal: 500,
};

/** Thrown anywhere in the pipeline; message must be safe to show to a user. */
export class ApiFailure extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "ApiFailure";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export function fail(code: ApiErrorCode, message: string): Response {
  const body: ApiError = { error: { code, message } };
  return Response.json(body, { status: STATUS_BY_CODE[code], headers: NO_STORE });
}

/** Convert anything thrown into a safe response. Never echoes unknown error text. */
export function failFrom(err: unknown): Response {
  if (err instanceof ApiFailure) return fail(err.code, err.message);
  console.error("[api] unexpected error:", err instanceof Error ? err.name : typeof err);
  return fail("internal", "Something went wrong. Please try again.");
}
