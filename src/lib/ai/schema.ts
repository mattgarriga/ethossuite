import { z } from "zod";
import type { AnalyzeOutput } from "@/lib/types";

// Zod mirror of AnalyzeOutput (and ANALYZE_SCHEMA in the reference migrator).
// Every object is strict (additionalProperties: false once converted). No numeric
// min/max constraints because the structured-output API does not support them.

const SeveritySchema = z.enum(["Critical", "High", "Medium", "Low"]);

const UsageEntrySchema = z.strictObject({
  name: z.string(),
  count: z.number(),
  targetModule: z.string().nullable(),
  mapped: z.boolean(),
});

export const AnalyzeOutputSchema = z.strictObject({
  scriptType: z.string().nullable(),
  entryPoints: z.array(z.string()),
  apiCalls: z.array(UsageEntrySchema),
  objectUsage: z.array(UsageEntrySchema),
  requiredModules: z.array(
    z.strictObject({
      module: z.string(),
      importName: z.string(),
      reason: z.string().optional(),
    }),
  ),
  breakingChanges: z.array(
    z.strictObject({
      change: z.string(),
      impact: z.string().optional(),
      severity: SeveritySchema,
    }),
  ),
  unmappedApis: z.array(
    z.strictObject({
      name: z.string(),
      workaround: z.string().optional(),
    }),
  ),
  complexityScore: z.strictObject({
    lineCount: z.number().optional(),
    nlapiCalls: z.number().optional(),
    subrecordUsage: z.number().optional(),
    dateTimeOps: z.number().optional(),
    recoveryPoints: z.number().optional(),
    customModules: z.number().optional(),
    sublistOps: z.number().optional(),
    total: z.number(),
  }),
  complexityRating: SeveritySchema,
  testingFocus: z.array(z.string()),
  migrationChecklist: z.array(z.string()),
  purposeDeterminable: z.boolean(),
  purposeSummary: z.string().nullable(),
  purposeNote: z.string().nullable(),
});

// Compile-time check: the schema's inferred type must equal AnalyzeOutput in both
// directions. If either side drifts, one of these assignments stops compiling.
type Inferred = z.infer<typeof AnalyzeOutputSchema>;
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const _schemaMatchesContract: Equals<Inferred, AnalyzeOutput> = true;
void _schemaMatchesContract;
