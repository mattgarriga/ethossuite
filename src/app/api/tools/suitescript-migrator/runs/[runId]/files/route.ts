import { ApiFailure, failFrom, json } from "@/lib/api";
import { assertCanSpend } from "@/lib/limits";
import { costUsd, ANALYSIS_MODEL } from "@/lib/ai/pricing";
import { getAnalyzer } from "@/lib/ai/analyzer";
import { loadOwnedRun, requireToolContext, type ToolContext } from "@/lib/suitescript/context";
import { deadlineFor } from "@/lib/suitescript/deadlines";
import { MAX_FILES, MAX_FILE_BYTES, validateUpload } from "@/lib/suitescript/upload";
import { detectApiVersion } from "@/lib/suitescript/version";
import type { AnalyzeResult, FileResultResponse, Severity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC = "Something went wrong. Please try again.";

async function countFindings(ctx: ToolContext, assessmentId: string): Promise<number> {
  const { count, error } = await ctx.admin
    .from("suitescript_migrator_findings")
    .select("id", { count: "exact", head: true })
    .eq("assessment_id", assessmentId);
  if (error) throw new ApiFailure("internal", GENERIC);
  return count ?? 0;
}

async function findAssessmentId(ctx: ToolContext, runId: string): Promise<string | null> {
  const { data, error } = await ctx.admin
    .from("suitescript_migrator_assessments")
    .select("id")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw new ApiFailure("internal", GENERIC);
  return (data?.id as string | undefined) ?? null;
}

/**
 * The assessment row is created lazily on the first file (findings.assessment_id is NOT NULL
 * and file_count must be 1..10). run_id is UNIQUE, so two concurrent first files race on the
 * insert; the loser gets 23505 and re-selects the winner's row.
 */
async function ensureAssessment(ctx: ToolContext, runId: string): Promise<string> {
  const existing = await findAssessmentId(ctx, runId);
  if (existing) return existing;
  const { data, error } = await ctx.admin
    .from("suitescript_migrator_assessments")
    .insert({ run_id: runId, file_count: 1, overall_risk: null })
    .select("id")
    .single();
  if (!error && data) return data.id as string;
  if (error?.code === "23505") {
    const winner = await findAssessmentId(ctx, runId);
    if (winner) return winner;
  }
  throw new ApiFailure("internal", GENERIC);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await params;
    const ctx = await requireToolContext();
    const run = await loadOwnedRun(ctx, runId);
    if (run.status !== "pending" && run.status !== "running") {
      throw new ApiFailure("run_not_open", "This assessment is no longer accepting files.");
    }

    const existingId = await findAssessmentId(ctx, runId);
    if (existingId && (await countFindings(ctx, existingId)) >= MAX_FILES) {
      throw new ApiFailure("too_many_files", `An assessment can include at most ${MAX_FILES} files.`);
    }

    await assertCanSpend(ctx.admin);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ApiFailure("invalid_file", "Upload a .js file in the \"file\" field.");
    }
    const entry = form.get("file");
    if (!(entry instanceof File)) {
      throw new ApiFailure("invalid_file", "Upload a .js file in the \"file\" field.");
    }
    if (entry.size > MAX_FILE_BYTES) {
      throw new ApiFailure("invalid_file", `The file is larger than the ${MAX_FILE_BYTES / 1024} KB limit.`);
    }
    const upload = validateUpload(entry.name, new Uint8Array(await entry.arrayBuffer()));
    if (!upload.ok) throw new ApiFailure("invalid_file", upload.message);
    const { fileName } = upload;
    // `source` stays in this scope only: never stored, logged or returned.
    let source: string | null = upload.source;

    if (run.status === "pending") {
      const { error } = await ctx.admin
        .from("runs")
        .update({ status: "running" })
        .eq("id", runId)
        .eq("user_id", ctx.user.id)
        .eq("status", "pending");
      if (error) throw new ApiFailure("internal", GENERIC);
    }

    const assessmentId = await ensureAssessment(ctx, runId);
    const apiVersion = detectApiVersion(source);

    let result: AnalyzeResult | null = null;
    try {
      result = await getAnalyzer().analyze({ fileName, source });
    } catch (err) {
      console.error("[suitescript] analysis failed:", err instanceof Error ? err.name : typeof err);
    }
    source = null;

    let row: Record<string, unknown>;
    let rating: Severity | null = null;
    if (result) {
      let cost: number;
      try {
        cost = costUsd(result.model, result.usage);
      } catch {
        cost = costUsd(ANALYSIS_MODEL, result.usage);
      }
      const { error: costErr } = await ctx.admin.from("usage_costs").insert({
        run_id: runId,
        file_name: fileName,
        model: result.model,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cache_read_tokens: result.usage.cacheReadTokens,
        cache_creation_tokens: result.usage.cacheCreationTokens,
        cost_usd: cost,
      });
      if (costErr) throw new ApiFailure("internal", GENERIC);

      const o = result.output;
      rating = o.complexityRating;
      row = {
        status: "completed",
        api_version: apiVersion,
        script_type: o.scriptType,
        complexity_score: o.complexityScore.total,
        complexity_rating: o.complexityRating,
        // Extra analyzer fields ride inside the existing jsonb columns (no migration).
        breaking_changes: { items: o.breakingChanges, unmappedApis: o.unmappedApis },
        migration_checklist: { items: o.migrationChecklist, testingFocus: o.testingFocus },
        purpose_summary: o.purposeSummary,
      };
      if (o.purposeNote) row.breaking_changes = { ...(row.breaking_changes as object), purposeNote: o.purposeNote };
    } else {
      row = {
        status: "failed",
        api_version: apiVersion,
        error: "This file could not be analyzed. It was skipped.",
      };
    }

    const { data: finding, error: findErr } = await ctx.admin
      .from("suitescript_migrator_findings")
      .insert({ assessment_id: assessmentId, file_name: fileName, ...row })
      .select("id")
      .single();
    if (findErr || !finding) throw new ApiFailure("internal", GENERIC);

    // Enforce the cap after the insert so concurrent uploads can't overshoot it,
    // and keep file_count = actual findings (recomputed, not incremented, to avoid lost updates).
    const total = await countFindings(ctx, assessmentId);
    if (total > MAX_FILES) {
      await ctx.admin.from("suitescript_migrator_findings").delete().eq("id", finding.id);
      throw new ApiFailure("too_many_files", `An assessment can include at most ${MAX_FILES} files.`);
    }
    await ctx.admin
      .from("suitescript_migrator_assessments")
      .update({ file_count: Math.max(1, total) })
      .eq("id", assessmentId);

    const body: FileResultResponse = {
      findingId: finding.id,
      fileName,
      status: result ? "completed" : "failed",
      apiVersion,
      complexityRating: rating,
      deadline: deadlineFor(apiVersion),
    };
    return json(body);
  } catch (err) {
    return failFrom(err);
  }
}
