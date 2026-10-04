/**
 * Draft phasing for the client-facing summary.
 *
 * This is arithmetic over script counts and the two Oracle deadlines — nothing
 * more. The tool has no visibility into the client's change-freeze calendar,
 * release schedule, or available resourcing, so the output is explicitly a
 * starting point for a human to adjust, and every consumer is expected to label
 * it as such. See GUARDRAIL_TEXT.noFabrication.
 */

import { DEADLINES } from './config.js';
import type { InventoryEntry, PriorityEntry } from './types.js';

export interface Phase {
  name: string;
  /** Business-language description — no script names, no code, no scoring. */
  focus: string;
  scriptCount: number;
  targetMilestone: string;
  rationale: string;
}

export interface PhasingDraft {
  phases: Phase[];
  totalInScope: number;
  /** Stated plainly wherever this is rendered. */
  caveat: string;
}

export function draftPhasing(
  flagged: InventoryEntry[],
  priorities: PriorityEntry[],
): PhasingDraft {
  const byId = new Map(flagged.map((e) => [e.id, e]));
  const ranked = priorities
    .map((p) => ({ priority: p, entry: byId.get(p.scriptId) }))
    .filter((r): r is { priority: PriorityEntry; entry: InventoryEntry } => r.entry !== undefined);

  const legacy = ranked.filter((r) => r.priority.versionTier <= 2);
  const modern = ranked.filter((r) => r.priority.versionTier === 3);

  // Within the 1.0 group, the complex work needs the longest runway, so it goes
  // first even though every item in the group shares one deadline.
  const legacyComplex = legacy.filter(
    (r) => r.priority.complexityRating === 'Critical' || r.priority.complexityRating === 'High',
  );
  const legacyRoutine = legacy.filter(
    (r) => r.priority.complexityRating !== 'Critical' && r.priority.complexityRating !== 'High',
  );

  const phases: Phase[] = [];

  if (legacyComplex.length > 0) {
    phases.push({
      name: 'Phase 1 — Highest-exposure customisations',
      focus:
        'The oldest customisations that also carry the most involved logic. These require the longest lead time for redevelopment and testing, so they start first.',
      scriptCount: legacyComplex.length,
      targetMilestone: `Complete well ahead of ${DEADLINES.ss10.label}`,
      rationale: `These customisations are built on the earliest supported version, which reaches end of support at ${DEADLINES.ss10.label} — roughly eighteen months before the wider deadline.`,
    });
  }

  if (legacyRoutine.length > 0) {
    phases.push({
      name: `Phase ${phases.length + 1} — Remaining early-version customisations`,
      focus:
        'The remainder of the oldest customisations, which are more contained and can be moved in larger batches once the approach is proven in Phase 1.',
      scriptCount: legacyRoutine.length,
      targetMilestone: `Complete before ${DEADLINES.ss10.label}`,
      rationale: `Same end-of-support date as Phase 1, with lower effort per item.`,
    });
  }

  if (modern.length > 0) {
    phases.push({
      name: `Phase ${phases.length + 1} — Current-generation customisations`,
      focus:
        'Customisations already on a recent version, which need a smaller uplift plus an account configuration change and a round of regression testing.',
      scriptCount: modern.length,
      targetMilestone: `Complete before ${DEADLINES.all.label}`,
      rationale: `These are not affected by the ${DEADLINES.ss10.label} milestone, but must be on the current version by ${DEADLINES.all.label}.`,
    });
  }

  return {
    phases,
    totalInScope: ranked.length,
    caveat:
      'This phasing is derived from the volume and technical profile of the customisations reviewed. It does not yet account for your change-freeze periods, financial calendar, or competing project commitments, and is intended as a starting point for joint planning.',
  };
}
