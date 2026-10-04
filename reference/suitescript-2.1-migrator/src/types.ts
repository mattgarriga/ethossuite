/**
 * Domain model for a single client migration audit run.
 *
 * Everything in `core/` and `reporting/` is written against these types. No HTTP
 * types, no branding, no Ethos specifics appear here — see reporting/theme.ts for
 * the branding seam and server/ for transport.
 */

/** SuiteScript version as detected from the file, not as asserted by the client. */
export type ScriptVersion = '1.0' | '2.0' | '2.x' | '2.1' | 'unknown';

/** Confidence in the detected version, per the skill's SS1.0 detection matrix. */
export type DetectionConfidence = 'definitive' | 'strong' | 'moderate' | 'weak';

export type ComplexityRating = 'Low' | 'Medium' | 'High' | 'Critical';

export type IssueSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export type StageName =
  | 'inventory'
  | 'analyze'
  | 'prioritize'
  | 'convert'
  | 'validate'
  | 'outputs';

export type StageStatus = 'pending' | 'running' | 'complete' | 'failed';

/** ------------------------------------------------------------------ */
/** Stage 1 — Inventory                                                  */
/** ------------------------------------------------------------------ */

export interface InventoryEntry {
  /** Stable id used as the key across every later stage. */
  id: string;
  /** Path relative to the uploaded file cabinet root. */
  relPath: string;
  fileName: string;
  sizeBytes: number;
  lineCount: number;

  /** Declared in the JSDoc header, if present at all. */
  declaredApiVersion: string | null;
  declaredScriptType: string | null;

  /** What we actually believe, after falling back to structural detection. */
  detectedVersion: ScriptVersion;
  detectionConfidence: DetectionConfidence;
  /** Human-readable reasons — shown in the UI and the internal document. */
  detectionSignals: string[];

  /** True when the script is not already 2.1 and therefore needs remediation. */
  flagged: boolean;
  /** Set when a file was skipped (not a script, unreadable, minified, etc.). */
  excludedReason: string | null;
}

/** ------------------------------------------------------------------ */
/** Stage 2 — Analyze (structured output from the Oracle skill)          */
/** ------------------------------------------------------------------ */

export interface ApiUsage {
  name: string;
  count: number;
  targetModule: string | null;
  mapped: boolean;
}

export interface RequiredModule {
  module: string;
  importName: string;
  reason: string;
}

export interface BreakingChange {
  change: string;
  impact: string;
  severity: IssueSeverity;
}

export interface UnmappedApi {
  name: string;
  workaround: string;
}

export interface ComplexityScore {
  lineCount: number;
  nlapiCalls: number;
  subrecordUsage: number;
  dateTimeOps: number;
  recoveryPoints: number;
  customModules: number;
  sublistOps: number;
  /** 7–21 per the skill's scoring matrix. */
  total: number;
}

export interface AnalyzeResult {
  scriptId: string;
  scriptType: string | null;
  entryPoints: string[];
  apiCalls: ApiUsage[];
  objectUsage: ApiUsage[];
  requiredModules: RequiredModule[];
  breakingChanges: BreakingChange[];
  unmappedApis: UnmappedApi[];
  complexityScore: ComplexityScore;
  complexityRating: ComplexityRating;
  /** Drives the per-script test plan appendix. */
  testingFocus: string[];
  migrationChecklist: string[];
  /**
   * Whether the script's business purpose is determinable from code alone.
   * When false, `purposeNote` explains what is missing rather than guessing —
   * see the no-fabrication guardrail.
   */
  purposeDeterminable: boolean;
  purposeSummary: string | null;
  purposeNote: string | null;
}

/** ------------------------------------------------------------------ */
/** Stage 3 — Prioritize                                                 */
/** ------------------------------------------------------------------ */

export interface PriorityEntry {
  scriptId: string;
  /** 1 = highest priority. */
  rank: number;
  /** Primary sort key: 1.0 scripts lose support first. */
  versionTier: number;
  complexityTotal: number;
  complexityRating: ComplexityRating;
  severity: IssueSeverity;
  /** Plain-language reason shown in the UI and the internal document. */
  justification: string;
}

/** ------------------------------------------------------------------ */
/** Stage 4 — Convert                                                    */
/** ------------------------------------------------------------------ */

export interface ConversionChange {
  line: number | null;
  before: string;
  after: string;
  note: string;
}

export interface ConvertResult {
  scriptId: string;
  status: 'converted' | 'failed';
  /** Path of the written 2.1 file, relative to the run's `converted/` dir. */
  outputRelPath: string | null;
  changes: ConversionChange[];
  deploymentXmlNotes: string[];
  migrationNotes: string[];
  postConversionChecklist: string[];
  error: string | null;
}

/** ------------------------------------------------------------------ */
/** Stage 5 — Validate                                                   */
/** ------------------------------------------------------------------ */

export interface ValidationIssue {
  line: number | null;
  issue: string;
  found: string;
  fix: string;
  severity: IssueSeverity;
}

export interface ValidateResult {
  scriptId: string;
  /** The skill fails a script when any Critical or High issue remains. */
  verdict: 'PASS' | 'FAIL';
  hasApiVersion21: boolean;
  hasScriptType: boolean;
  hasDefineWrapper: boolean;
  hasReturnObject: boolean;
  issues: ValidationIssue[];
  counts: Record<IssueSeverity, number>;
  /** True when the script needs a human before it can go to sandbox. */
  requiresManualFollowUp: boolean;
  error: string | null;
}

/** ------------------------------------------------------------------ */
/** Run state                                                            */
/** ------------------------------------------------------------------ */

export interface StageState {
  status: StageStatus;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  /** Live progress for the UI while a stage runs. */
  processed: number;
  total: number;
  /**
   * Set when the stage stopped because the Claude account hit its usage limit
   * rather than because anything was wrong. Completed scripts are kept, so
   * resuming later picks up where it left off.
   */
  blockedByRateLimit: boolean;
  /** Scripts skipped this run because they already had a good result. */
  skipped: number;
}

export interface UsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  /** Counted separately: most of a skill run's input lands here, not in inputTokens. */
  cacheCreationTokens: number;
  costUsd: number;
  agentRuns: number;
}

export interface GeneratedOutput {
  kind: 'action-list' | 'test-plan';
  fileName: string;
  /** Absolute path to where the file was written (the OS Downloads folder). */
  relPath: string;
  bytes: number;
  generatedAt: string;
}

export interface RunState {
  runId: string;
  clientName: string;
  createdAt: string;
  sourceFileCount: number;

  stages: Record<StageName, StageState>;

  inventory: InventoryEntry[];
  analyses: Record<string, AnalyzeResult>;
  priorities: PriorityEntry[];
  conversions: Record<string, ConvertResult>;
  validations: Record<string, ValidateResult>;
  outputs: GeneratedOutput[];

  usage: UsageTotals;
  /** Non-fatal problems worth surfacing to the team. */
  warnings: string[];

  /**
   * Which flagged scripts the agent stages should process. Null means all of
   * them. Used to split one cabinet across several people, so each person's
   * share draws on their own Claude seat.
   */
  selectedScriptIds: string[] | null;
  /** Free-text note on who is working this slice. Shown in the UI only. */
  assignedTo: string | null;
}

export const STAGE_ORDER: StageName[] = [
  'inventory',
  'analyze',
  'prioritize',
  'convert',
  'validate',
  'outputs',
];

export function emptyStage(): StageState {
  return {
    status: 'pending',
    startedAt: null,
    completedAt: null,
    error: null,
    processed: 0,
    total: 0,
    blockedByRateLimit: false,
    skipped: 0,
  };
}

export function newRunState(runId: string, clientName: string): RunState {
  return {
    runId,
    clientName,
    createdAt: new Date().toISOString(),
    sourceFileCount: 0,
    stages: {
      inventory: emptyStage(),
      analyze: emptyStage(),
      prioritize: emptyStage(),
      convert: emptyStage(),
      validate: emptyStage(),
      outputs: emptyStage(),
    },
    inventory: [],
    analyses: {},
    priorities: [],
    conversions: {},
    validations: {},
    outputs: [],
    selectedScriptIds: null,
    assignedTo: null,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      costUsd: 0,
      agentRuns: 0,
    },
    warnings: [],
  };
}
