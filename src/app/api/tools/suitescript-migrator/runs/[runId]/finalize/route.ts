import { ApiFailure, failFrom, json } from "@/lib/api";
import { loadOwnedRun, requireToolContext, type ToolContext } from "@/lib/suitescript/context";
import { overallRisk, summarize, type SummaryFinding } from "@/lib/suitescript/risk";
import type { ApiVersion, FinalizeResponse, Severity } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERIC = "Something went wrong. Please try again.";

type FindingRow = {
  file_name: string;
  status: "completed" | "failed";
  api_version: ApiVersion | null;
  complexity_rating: Severity | null;
  complexity_score: number | null;
  breaking_changes: { items?: { change: string; severity: Severity }[] } | null;
};

async function getAssessment(ctx: ToolContext, runId: string) {
  const { data, error } = await ctx.admin
    .from("suitescript_migrator_assessments")
    .select("id, file_count, overall_risk")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) throw new ApiFailure("internal", GENERIC);
  return data as { id: string; file_count: number; overall_risk: Severity | null } | null;
}

async function finalizeRun(ctx: ToolContext, runId: string): Promise<FinalizeResponse> {
  const assessment = await getAssessment(ctx, runId);
  if (!assessment) throw new ApiFailure("run_not_open", "Add at least one file before finishing.");

  const { data, error } = await ctx.admin
    .from("suitescript_migrator_findings")
    .select("file_name, status, api_version, complexity_rating, complexity_score, breaking_changes")
    .eq("assessment_id", assessment.id);
  if (error) throw new Error("findings read failed");
  const rows = (data ?? []) as FindingRow[];
  if (rows.length === 0) throw new ApiFailure("run_not_open", "Add at least one file before finishing.");

  const findings: SummaryFinding[] = rows.map((r) => ({
    fileName: r.file_name,
    status: r.status,
    apiVersion: r.api_version,
    complexityRating: r.complexity_rating,
    complexityScore: r.complexity_score,
    breakingChanges: r.breaking_changes?.items ?? [],
  }));
  const risk = overallRisk(findings.map((f) => f.complexityRating));

  const { error: aErr } = await ctx.admin
    .from("suitescript_migrator_assessments")
    .update({ file_count: Math.min(10, rows.length), overall_risk: risk, summary: summarize(findings) })
    .eq("id", assessment.id);
  if (aErr) throw new Error("assessment update failed");

  // Lead: profile data comes from the verified user. Skip if there is no email (column is NOT NULL).
  const email = ctx.user.email;
  if (email) {
    const { error: lErr } = await ctx.admin.from("leads").upsert(
      {
        user_id: ctx.user.id,
        source_tool_id: ctx.toolId,
        email,
        full_name: ctx.user.fullName?.trim() || email.split("@")[0],
        company_name: ctx.user.companyName,
      },
      { onConflict: "user_id,source_tool_id" },
    );
    if (lErr) throw new Error("lead upsert failed");
  }

  const { error: rErr } = await ctx.admin
    .from("runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("user_id", ctx.user.id)
    .eq("status", "running");
  if (rErr) throw new Error("run update failed");

  return { assessmentId: assessment.id, overallRisk: risk, fileCount: Math.min(10, rows.length) };
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await params;
    const ctx = await requireToolContext();
    const run = await loadOwnedRun(ctx, runId);

    if (run.status === "completed") {
      // Idempotent: return the stored result.
      const a = await getAssessment(ctx, runId);
      if (!a) throw new ApiFailure("internal", GENERIC);
      const body: FinalizeResponse = { assessmentId: a.id, overallRisk: a.overall_risk, fileCount: a.file_count };
      return json(body);
    }
    if (run.status !== "running") {
      throw new ApiFailure("run_not_open", "This assessment can't be finished in its current state.");
    }

    try {
      return json(await finalizeRun(ctx, runId));
    } catch (err) {
      if (err instanceof ApiFailure) throw err;
      console.error("[suitescript] finalize failed:", err instanceof Error ? err.message : typeof err);
      await ctx.admin
        .from("runs")
        .update({ status: "failed", error: "Could not complete the assessment." })
        .eq("id", runId)
        .eq("user_id", ctx.user.id)
        .eq("status", "running");
      throw new ApiFailure("internal", GENERIC);
    }
  } catch (err) {
    return failFrom(err);
  }
}
