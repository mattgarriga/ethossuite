import type { ApiVersion, Severity } from "@/lib/types";
import { deadlineFor, type Deadline } from "./deadlines";

const SEVERITY_ORDER: Severity[] = ["Low", "Medium", "High", "Critical"];

/** Highest severity present, or null when there are none. */
export function overallRisk(ratings: (Severity | null)[]): Severity | null {
  let best = -1;
  for (const r of ratings) {
    if (r === null || r === undefined) continue;
    const idx = SEVERITY_ORDER.indexOf(r);
    if (idx > best) best = idx;
  }
  return best === -1 ? null : SEVERITY_ORDER[best];
}

export type SummaryFinding = {
  fileName: string;
  status: "completed" | "failed";
  apiVersion: ApiVersion | null;
  complexityRating: Severity | null;
  complexityScore: number | null;
  breakingChanges: { change: string; severity: Severity }[];
  unmappedApiCount?: number;
};

export type AssessmentSummary = {
  totalFiles: number;
  failedFiles: number;
  ratingCounts: Record<Severity, number>;
  apiVersionCounts: Record<ApiVersion, number>;
  earliestDeadline: Deadline | null;
  topBreakingChanges: { change: string; count: number }[];
  /** Ranked remediation order (version tier, then complexity). */
  priorities: { rank: number; fileName: string; apiVersion: ApiVersion; complexityRating: Severity | null }[];
  /** Draft phasing counts only; human planning still required. */
  phasing: { legacyHighEffort: number; legacyOther: number; current: number };
};

export const TOP_BREAKING_CHANGES = 5;

/** Lower is more urgent. Ported from prioritize.ts versionTier (2.0/2.x merged as "2.0"). */
export function versionTier(v: ApiVersion): number {
  switch (v) {
    case "1.0": return 1;
    case "unknown": return 2; // may be an unclassified 1.0 script, so treat as urgent
    case "2.0": return 3;
    case "2.1": return 4;
  }
}

export function summarize(findings: SummaryFinding[]): AssessmentSummary {
  const ratingCounts: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const apiVersionCounts: Record<ApiVersion, number> = { "1.0": 0, "2.0": 0, "2.1": 0, unknown: 0 };
  const changeCounts = new Map<string, number>();
  let failedFiles = 0;
  let earliest: Deadline | null = null;

  for (const f of findings) {
    if (f.status === "failed") failedFiles++;
    if (f.complexityRating) ratingCounts[f.complexityRating]++;
    const v = f.apiVersion ?? "unknown";
    apiVersionCounts[v]++;
    const d = deadlineFor(v);
    if (!earliest || d.approxDate < earliest.approxDate) earliest = d;
    for (const bc of f.breakingChanges) {
      const key = bc.change.trim();
      if (key) changeCounts.set(key, (changeCounts.get(key) ?? 0) + 1);
    }
  }

  const topBreakingChanges = [...changeCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_BREAKING_CHANGES)
    .map(([change, count]) => ({ change, count }));

  const completed = findings.filter((f) => f.status === "completed");
  const ranked = [...completed].sort((a, b) => {
    const ta = versionTier(a.apiVersion ?? "unknown");
    const tb = versionTier(b.apiVersion ?? "unknown");
    if (ta !== tb) return ta - tb;
    const sa = a.complexityScore ?? 0;
    const sb = b.complexityScore ?? 0;
    if (sa !== sb) return sb - sa;
    const ua = a.unmappedApiCount ?? 0;
    const ub = b.unmappedApiCount ?? 0;
    if (ua !== ub) return ub - ua;
    return a.fileName.localeCompare(b.fileName);
  });

  const isLegacy = (f: SummaryFinding) => versionTier(f.apiVersion ?? "unknown") <= 2;
  const isHigh = (f: SummaryFinding) => f.complexityRating === "Critical" || f.complexityRating === "High";

  return {
    totalFiles: findings.length,
    failedFiles,
    ratingCounts,
    apiVersionCounts,
    earliestDeadline: earliest,
    topBreakingChanges,
    priorities: ranked.map((f, i) => ({
      rank: i + 1,
      fileName: f.fileName,
      apiVersion: f.apiVersion ?? "unknown",
      complexityRating: f.complexityRating,
    })),
    phasing: {
      legacyHighEffort: completed.filter((f) => isLegacy(f) && isHigh(f)).length,
      legacyOther: completed.filter((f) => isLegacy(f) && !isHigh(f)).length,
      current: completed.filter((f) => !isLegacy(f)).length,
    },
  };
}
