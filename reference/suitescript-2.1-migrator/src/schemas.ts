/**
 * JSON Schemas (draft-07) for the structured output of each skill mode.
 *
 * These mirror the report shapes documented in the Oracle SKILL.md, but as data
 * rather than markdown — the whole point is that later stages and the document
 * generators consume typed fields, not a parsed report.
 *
 * Required lists are deliberately short. Per the SDK's structured-output
 * guidance, deeply required schemas fail validation more often; a missing
 * optional field is cheaper to handle than a failed run.
 */

const severityEnum = { type: 'string', enum: ['Critical', 'High', 'Medium', 'Low'] } as const;

export const ANALYZE_SCHEMA = {
  type: 'object',
  properties: {
    scriptType: {
      type: ['string', 'null'],
      description:
        'Detected NetSuite script type, e.g. UserEventScript, ClientScript, Suitelet, Restlet, ScheduledScript, MapReduceScript, Portlet, MassUpdateScript, BundleInstallationScript, WorkflowActionScript. Null if it cannot be determined from the code.',
    },
    entryPoints: {
      type: 'array',
      items: { type: 'string' },
      description: 'Names of detected entry point functions.',
    },
    apiCalls: {
      type: 'array',
      description: 'Every distinct legacy nlapi* function call found.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
          targetModule: {
            type: ['string', 'null'],
            description: 'The N/* module it maps to, or null when unmapped.',
          },
          mapped: { type: 'boolean' },
        },
        required: ['name', 'count', 'mapped'],
      },
    },
    objectUsage: {
      type: 'array',
      description: 'Every distinct legacy nlobj* object used.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
          targetModule: { type: ['string', 'null'], description: 'The SuiteScript 2.1 class.' },
          mapped: { type: 'boolean' },
        },
        required: ['name', 'count', 'mapped'],
      },
    },
    requiredModules: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          module: { type: 'string', description: 'e.g. N/record' },
          importName: { type: 'string', description: 'e.g. record' },
          reason: { type: 'string' },
        },
        required: ['module', 'importName'],
      },
    },
    breakingChanges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          change: { type: 'string' },
          impact: { type: 'string', description: 'Concrete scope, e.g. "3 loop constructs".' },
          severity: severityEnum,
        },
        required: ['change', 'severity'],
      },
    },
    unmappedApis: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          workaround: { type: 'string' },
        },
        required: ['name'],
      },
    },
    complexityScore: {
      type: 'object',
      description: "Per the skill's 7-21 point scoring matrix; each factor is 1, 2 or 3.",
      properties: {
        lineCount: { type: 'number' },
        nlapiCalls: { type: 'number' },
        subrecordUsage: { type: 'number' },
        dateTimeOps: { type: 'number' },
        recoveryPoints: { type: 'number' },
        customModules: { type: 'number' },
        sublistOps: { type: 'number' },
        total: { type: 'number' },
      },
      required: ['total'],
    },
    complexityRating: { type: 'string', enum: ['Low', 'Medium', 'High', 'Critical'] },
    testingFocus: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Specific behaviours a tester must exercise in a sandbox after conversion. Each item should be concrete enough to become a test case.',
    },
    migrationChecklist: { type: 'array', items: { type: 'string' } },
    purposeDeterminable: {
      type: 'boolean',
      description:
        'True only when the script’s business purpose is clear from the code itself. Do not infer purpose from file naming alone.',
    },
    purposeSummary: {
      type: ['string', 'null'],
      description:
        'One or two sentences on what the script does, strictly grounded in the code. Null when purposeDeterminable is false.',
    },
    purposeNote: {
      type: ['string', 'null'],
      description:
        'When purposeDeterminable is false, state what additional context is needed (e.g. "references custom record customrecord_abc with no description in scope"). Never guess.',
    },
  },
  required: ['complexityRating', 'complexityScore', 'testingFocus', 'purposeDeterminable'],
} as const;

export const CONVERT_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['converted', 'failed'] },
    outputRelPath: {
      type: ['string', 'null'],
      description: 'Path of the written SuiteScript 2.1 file, relative to the run working directory.',
    },
    changes: {
      type: 'array',
      description: 'The numbered change annotations produced by --annotated.',
      items: {
        type: 'object',
        properties: {
          line: { type: ['number', 'null'] },
          before: { type: 'string' },
          after: { type: 'string' },
          note: { type: 'string' },
        },
        required: ['before', 'after'],
      },
    },
    deploymentXmlNotes: {
      type: 'array',
      items: { type: 'string' },
      description: 'Changes needed in the script deployment XML, e.g. removed entry point names.',
    },
    migrationNotes: { type: 'array', items: { type: 'string' } },
    postConversionChecklist: { type: 'array', items: { type: 'string' } },
    error: {
      type: ['string', 'null'],
      description: 'Populated only when status is "failed".',
    },
  },
  required: ['status'],
} as const;

export const VALIDATE_SCHEMA = {
  type: 'object',
  properties: {
    verdict: {
      type: 'string',
      enum: ['PASS', 'FAIL'],
      description: 'FAIL if any Critical or High issue remains.',
    },
    hasApiVersion21: { type: 'boolean' },
    hasScriptType: { type: 'boolean' },
    hasDefineWrapper: { type: 'boolean' },
    hasReturnObject: { type: 'boolean' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          line: { type: ['number', 'null'] },
          issue: { type: 'string' },
          found: { type: 'string' },
          fix: { type: 'string' },
          severity: severityEnum,
        },
        required: ['issue', 'severity'],
      },
    },
  },
  required: ['verdict', 'issues'],
} as const;
