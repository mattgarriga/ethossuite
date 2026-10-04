/**
 * Stage 3 — Prioritize.
 *
 * Ranking is deliberately deterministic and explainable: the internal document
 * has to justify every position to a client, so no model judgement enters here.
 *
 * Sort keys, in order:
 *   1. Version tier — 1.0 outranks 2.0/2.x because 1.0 loses support at 2027.1
 *      while everything else has until 2028.2.
 *   2. Complexity/risk from the analyze output — higher score first, because a
 *      complex script needs the most lead time before its deadline.
 *   3. Unmapped API count, then line count, as stable tie-breakers.
 */

import { DEADLINES } from './config.js';
import type {
  AnalyzeResult,
  InventoryEntry,
  IssueSeverity,
  PriorityEntry,
  ScriptVersion,
} from './types.js';

/** Lower tier number = more urgent. */
export function versionTier(version: ScriptVersion): number {
  switch (version) {
    case '1.0':
      return 1;
    case 'unknown':
      // Unknown outranks confirmed 2.x: it may be a 1.0 script we could not
      // classify, and guessing downward would hide a 2027.1 exposure.
      return 2;
    case '2.0':
    case '2.x':
      return 3;
    case '2.1':
      return 4;
  }
}

function severityFor(tier: number, rating: AnalyzeResult['complexityRating'] | null): IssueSeverity {
  if (tier === 1) {
    return rating === 'Critical' || rating === 'High' ? 'Critical' : 'High';
  }
  if (tier === 2) return 'High';
  if (rating === 'Critical') return 'High';
  if (rating === 'High') return 'Medium';
  return 'Low';
}

function justify(
  entry: InventoryEntry,
  analysis: AnalyzeResult | undefined,
  tier: number,
): string {
  const parts: string[] = [];

  if (tier === 1) {
    parts.push(
      `SuiteScript 1.0 — support ends at ${DEADLINES.ss10.label}, ahead of the ${DEADLINES.all.label} deadline for all other versions`,
    );
  } else if (tier === 2) {
    parts.push(
      `Version could not be confirmed from the source (${entry.detectionConfidence} confidence) — treated as potentially 1.0 pending review`,
    );
  } else {
    parts.push(`SuiteScript ${entry.detectedVersion} — must run on 2.1 by ${DEADLINES.all.label}`);
  }

  if (analysis) {
    parts.push(
      `${analysis.complexityRating.toLowerCase()} conversion complexity (${analysis.complexityScore.total}/21)`,
    );
    if (analysis.unmappedApis.length > 0) {
      parts.push(
        `${analysis.unmappedApis.length} API${analysis.unmappedApis.length === 1 ? '' : 's'} with no direct 2.1 equivalent`,
      );
    }
    const blocking = analysis.breakingChanges.filter(
      (c) => c.severity === 'Critical' || c.severity === 'High',
    ).length;
    if (blocking > 0) {
      parts.push(`${blocking} high-impact breaking change${blocking === 1 ? '' : 's'}`);
    }
    if (!analysis.purposeDeterminable) {
      parts.push('business purpose not determinable from code — SME confirmation required');
    }
  } else {
    parts.push('not yet analyzed');
  }

  return parts.join('; ');
}

export function prioritize(
  flagged: InventoryEntry[],
  analyses: Record<string, AnalyzeResult>,
): PriorityEntry[] {
  const rows = flagged.map((entry) => {
    const analysis = analyses[entry.id];
    const tier = versionTier(entry.detectedVersion);
    const complexityTotal = analysis?.complexityScore.total ?? 0;

    return {
      entry,
      analysis,
      tier,
      complexityTotal,
      unmapped: analysis?.unmappedApis.length ?? 0,
    };
  });

  rows.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.complexityTotal !== b.complexityTotal) return b.complexityTotal - a.complexityTotal;
    if (a.unmapped !== b.unmapped) return b.unmapped - a.unmapped;
    if (a.entry.lineCount !== b.entry.lineCount) return b.entry.lineCount - a.entry.lineCount;
    return a.entry.relPath.localeCompare(b.entry.relPath);
  });

  return rows.map((row, index) => ({
    scriptId: row.entry.id,
    rank: index + 1,
    versionTier: row.tier,
    complexityTotal: row.complexityTotal,
    complexityRating: row.analysis?.complexityRating ?? 'Low',
    severity: severityFor(row.tier, row.analysis?.complexityRating ?? null),
    justification: justify(row.entry, row.analysis, row.tier),
  }));
}
