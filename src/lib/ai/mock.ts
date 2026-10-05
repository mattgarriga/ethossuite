import type { Analyzer, AnalyzeOutput, AnalyzeResult, Severity } from "@/lib/types";
import { ANALYSIS_MODEL } from "@/lib/ai/pricing";
import { SYSTEM_PROMPT } from "@/lib/ai/prompt";
import { AnalysisError } from "@/lib/ai/errors";

// Deterministic, network-free analyzer. It does simple static inspection of the source
// so that the output looks plausible and the cost/usage paths are exercised.

export const PROMPT_TOKEN_ESTIMATE = Math.ceil(SYSTEM_PROMPT.length / 4);

const SERVER_FIELD_FNS = [
  "nlapiGetFieldValue", "nlapiSetFieldValue", "nlapiGetFieldText", "nlapiSetFieldText",
  "nlapiGetLineItemValue", "nlapiSetCurrentLineItemValue", "nlapiSelectNewLineItem",
  "nlapiCommitLineItem", "nlapiGetLineItemCount", "nlapiInsertLineItem", "nlapiRemoveLineItem",
  "nlapiDisableField", "nlapiGetCurrentLineItemValue", "nlapiSelectLineItem", "nlapiSetLineItemValue",
  "nlapiGetNewRecord", "nlapiGetOldRecord", "nlapiGetRecordId", "nlapiGetRecordType",
];

const API_MODULES: Record<string, string> = {
  nlapiCreateRecord: "N/record", nlapiLoadRecord: "N/record", nlapiSubmitRecord: "N/record",
  nlapiDeleteRecord: "N/record", nlapiCopyRecord: "N/record", nlapiTransformRecord: "N/record",
  nlapiSubmitField: "N/record", nlapiAttachRecord: "N/record", nlapiDetachRecord: "N/record",
  nlapiSearchRecord: "N/search", nlapiCreateSearch: "N/search", nlapiLoadSearch: "N/search",
  nlapiLookupField: "N/search", nlapiSearchDuplicate: "N/search", nlapiSearchGlobal: "N/search",
  nlapiLogExecution: "N/log",
  nlapiSendEmail: "N/email", nlapiSendCampaignEmail: "N/email",
  nlapiRequestURL: "N/https", nlapiRequestURLWithCredentials: "N/https",
  nlapiResolveURL: "N/url", nlapiSetRedirectURL: "N/redirect",
  nlapiCreateFile: "N/file", nlapiLoadFile: "N/file", nlapiDeleteFile: "N/file", nlapiSubmitFile: "N/file",
  nlapiCreateForm: "N/ui/serverWidget", nlapiCreateList: "N/ui/serverWidget", nlapiCreateAssistant: "N/ui/serverWidget",
  nlapiCreateError: "N/error",
  nlapiGetContext: "N/runtime", nlapiGetUser: "N/runtime", nlapiGetRole: "N/runtime",
  nlapiGetDepartment: "N/runtime", nlapiGetLocation: "N/runtime", nlapiGetSubsidiary: "N/runtime",
  nlapiDateToString: "N/format", nlapiStringToDate: "N/format", nlapiFormatCurrency: "N/format",
  nlapiCreateTemplateRenderer: "N/render", nlapiXMLToPDF: "N/render", nlapiPrintRecord: "N/render",
  nlapiCreateEmailMerger: "N/render",
  nlapiScheduleScript: "N/task", nlapiCreateCSVImport: "N/task",
  nlapiEscapeXML: "N/xml", nlapiStringToXML: "N/xml", nlapiXMLToString: "N/xml",
  nlapiSelectNode: "N/xml", nlapiSelectNodes: "N/xml", nlapiSelectValue: "N/xml", nlapiValidateXML: "N/xml",
  nlapiExchangeRate: "N/currency", nlapiLoadConfiguration: "N/config", nlapiGetLogin: "N/auth",
  nlapiInitiateWorkflow: "N/workflow", nlapiTriggerWorkflow: "N/workflow",
  nlapiVoidTransaction: "N/transaction", nlapiOutboundSSO: "N/sso",
};

const UNMAPPED_WORKAROUNDS: Record<string, string> = {
  nlapiAddDays: "Use native Date.setDate.",
  nlapiAddMonths: "Use native Date.setMonth; watch month-end rollover.",
  nlapiEncrypt: "Use N/crypto createHash/HMAC with N/encode.",
  nlapiGetDateTimeValue: "Read raw value, format with N/format and format.Timezone.",
  nlapiSetDateTimeValue: "Format with N/format, then setValue.",
  nlapiGetLineItemDateTimeValue: "Use N/format; line index becomes 0-based.",
  nlapiSetLineItemDateTimeValue: "Format with N/format, then setSublistValue.",
  nlapiGetCurrentLineItemDateTimeValue: "Use N/format with format.Timezone.",
  nlapiSetCurrentLineItemDateTimeValue: "Format with N/format, then setCurrentSublistValue.",
  nlapiSetRecoveryPoint: "Convert to Map/Reduce or reschedule via N/task.",
  nlapiYieldScript: "Convert to Map/Reduce, which yields automatically.",
  nlapiRefreshLineItems: "No equivalent; the platform refreshes sublists itself.",
  nlapiSendFax: "Use a third-party fax service via N/https.",
  nlapiIncludeScript: "Convert the library to an AMD module loaded in define().",
};

const OBJECT_MODULES: Record<string, string> = {
  nlobjRecord: "record.Record", nlobjSearch: "search.Search", nlobjSearchFilter: "search.Filter",
  nlobjSearchColumn: "search.Column", nlobjSearchResult: "search.Result",
  nlobjSearchResultSet: "search.ResultSet", nlobjError: "error.SuiteScriptError",
  nlobjFile: "file.File", nlobjForm: "serverWidget.Form", nlobjField: "serverWidget.Field",
  nlobjSublist: "serverWidget.Sublist", nlobjButton: "serverWidget.Button", nlobjTab: "serverWidget.Tab",
  nlobjList: "serverWidget.List", nlobjAssistant: "serverWidget.Assistant", nlobjPortlet: "serverWidget.Portlet",
  nlobjContext: "runtime.Script", nlobjRequest: "http.ServerRequest", nlobjResponse: "http.ServerResponse",
  nlobjTemplateRenderer: "render.TemplateRenderer", nlobjCSVImport: "task.CsvImportTask",
  nlobjConfiguration: "config.Config",
};

const SCRIPT_TYPES = [
  "UserEventScript", "ClientScript", "ScheduledScript", "Suitelet", "Restlet", "MapReduceScript",
  "Portlet", "MassUpdateScript", "BundleInstallationScript", "WorkflowActionScript", "SDFInstallationScript",
];

const ENTRY_POINTS: Record<string, string[]> = {
  UserEventScript: ["beforeLoad", "beforeSubmit", "afterSubmit"],
  ClientScript: ["pageInit", "fieldChanged", "postSourcing", "sublistChanged", "lineInit", "validateField",
    "validateLine", "validateInsert", "validateDelete", "saveRecord", "recalc"],
  ScheduledScript: ["execute"],
  Suitelet: ["onRequest"],
  Restlet: ["get", "post", "put", "delete"],
  MapReduceScript: ["getInputData", "map", "reduce", "summarize"],
  Portlet: ["render"],
  MassUpdateScript: ["each"],
  BundleInstallationScript: ["beforeInstall", "afterInstall", "beforeUpdate", "afterUpdate", "beforeUninstall"],
  WorkflowActionScript: ["onAction"],
  SDFInstallationScript: ["run"],
};

/** Replace comments and string literals with spaces (newlines kept) so calls inside them are not counted. */
export function stripCommentsAndStrings(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "")
    .replace(/"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, (m) => '"' + " ".repeat(Math.max(0, m.length - 2)) + '"');
}

function countMatches(src: string, re: RegExp): Map<string, number> {
  const m = new Map<string, number>();
  for (const hit of src.matchAll(re)) m.set(hit[0], (m.get(hit[0]) ?? 0) + 1);
  return m;
}

function sortedEntries(m: Map<string, number>): [string, number][] {
  return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

export function detectScriptType(raw: string, clean: string): string | null {
  const tag = /@NScriptType\s+(\w+)/.exec(raw)?.[1];
  if (tag) {
    const hit = SCRIPT_TYPES.find((t) => t.toLowerCase() === tag.toLowerCase());
    return hit ?? tag;
  }
  const defines = (name: string) =>
    new RegExp(`(?:function\\s+${name}\\b|\\b${name}\\s*[:=]\\s*(?:function|\\())`).test(clean);
  for (const t of ["UserEventScript", "Suitelet", "Restlet", "MapReduceScript", "ScheduledScript", "ClientScript"]) {
    const eps = ENTRY_POINTS[t];
    if (eps.some((e) => !["get", "post", "put", "delete", "map", "reduce", "execute", "each", "run", "render"].includes(e) && defines(e))) return t;
  }
  if (/\bnlapiYieldScript|nlapiSetRecoveryPoint/.test(clean)) return "ScheduledScript";
  if (/\bnlobjResponse|\bresponse\.write/.test(clean)) return "Suitelet";
  return null;
}

function ratingFor(total: number): Severity {
  if (total <= 10) return "Low";
  if (total <= 15) return "Medium";
  if (total <= 18) return "High";
  return "Critical";
}

export function analyzeStatically(fileName: string, source: string): { output: AnalyzeOutput; callCount: number } {
  void fileName; // never used to infer purpose
  const clean = stripCommentsAndStrings(source);
  const lineCount = source.length === 0 ? 0 : source.split("\n").length;

  const apis = sortedEntries(countMatches(clean, /\bnlapi[A-Za-z0-9_]*(?=\s*\()/g));
  const objs = sortedEntries(countMatches(clean, /\bnlobj[A-Za-z0-9_]*/g));
  const scriptType = detectScriptType(source, clean);
  const isClient = scriptType === "ClientScript";

  const moduleFor = (name: string): string | null => {
    if (SERVER_FIELD_FNS.includes(name)) return isClient ? "N/currentRecord" : "N/record";
    return API_MODULES[name] ?? null;
  };

  const apiCalls = apis.map(([name, count]) => {
    const targetModule = moduleFor(name);
    return { name, count, targetModule, mapped: targetModule !== null };
  });
  const objectUsage = objs.map(([name, count]) => {
    const targetModule = OBJECT_MODULES[name] ?? null;
    return { name, count, targetModule, mapped: targetModule !== null };
  });

  const entryPoints: string[] = [];
  if (scriptType && ENTRY_POINTS[scriptType]) {
    for (const e of ENTRY_POINTS[scriptType]) {
      if (new RegExp(`(?:function\\s+${e}\\b|\\b${e}\\s*[:=])`).test(clean)) entryPoints.push(e);
    }
  }

  const moduleSet = new Map<string, string>();
  for (const a of apiCalls) {
    if (!a.targetModule) continue;
    moduleSet.set(a.targetModule, a.targetModule.split("/").pop() as string);
  }
  const requiredModules = [...moduleSet.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([module, importName]) => ({ module, importName, reason: "Replaces legacy nlapi* calls" }));

  const unmappedApis = apiCalls
    .filter((a) => !a.mapped || UNMAPPED_WORKAROUNDS[a.name])
    .map((a) => ({ name: a.name, workaround: UNMAPPED_WORKAROUNDS[a.name] ?? "No direct equivalent; review manually." }));
  // Calls with a workaround table entry are not directly mapped.
  for (const a of apiCalls) if (UNMAPPED_WORKAROUNDS[a.name]) { a.mapped = false; a.targetModule = null; }

  const names = new Set(apis.map(([n]) => n));
  const callCount = apis.reduce((n, [, c]) => n + c, 0);
  const sublistNames = [...names].filter((n) => /LineItem/.test(n));
  const dynamicSublist = sublistNames.some((n) => /Insert|Remove|Select|Commit|SetCurrent/.test(n));
  const subrecNames = [...names].filter((n) => /Subrecord/.test(n));
  const subrecWrite = subrecNames.some((n) => /Create|Edit/.test(n));
  const dtNames = [...names].filter((n) => /DateTimeValue/.test(n));
  const dtSublist = dtNames.some((n) => /LineItem/.test(n));
  const includes = names.has("nlapiIncludeScript") ? (apis.find(([n]) => n === "nlapiIncludeScript")![1]) : 0;
  const hasRecovery = names.has("nlapiSetRecoveryPoint");
  const hasYield = names.has("nlapiYieldScript");

  const score = {
    lineCount: lineCount < 100 ? 1 : lineCount <= 500 ? 2 : 3,
    nlapiCalls: apis.length < 10 ? 1 : apis.length <= 30 ? 2 : 3,
    subrecordUsage: subrecNames.length === 0 ? 1 : subrecWrite ? 3 : 2,
    dateTimeOps: dtNames.length === 0 ? 1 : dtSublist ? 3 : 2,
    recoveryPoints: !hasRecovery && !hasYield ? 1 : hasRecovery && hasYield ? 3 : 2,
    customModules: includes === 0 ? 1 : includes <= 2 ? 2 : 3,
    sublistOps: sublistNames.length === 0 ? 1 : dynamicSublist ? 3 : 2,
  };
  const total = Object.values(score).reduce((a, b) => a + b, 0);
  const complexityRating = ratingFor(total);

  const breakingChanges: AnalyzeOutput["breakingChanges"] = [];
  if (apis.length > 0 || objs.length > 0) {
    breakingChanges.push({ change: "Global nlapi*/nlobj* functions replaced by AMD define() modules", impact: `${apis.length} distinct nlapi functions`, severity: "High" });
    breakingChanges.push({ change: "Positional parameters become options objects", impact: `${callCount} call sites`, severity: callCount >= 30 ? "High" : "Medium" });
  }
  if (sublistNames.length > 0) {
    breakingChanges.push({ change: "Sublist indexing changes from 1-based to 0-based", impact: `${sublistNames.length} sublist functions`, severity: dynamicSublist ? "Critical" : "High" });
  }
  if (dtNames.length > 0) breakingChanges.push({ change: "Timezone-aware date-time calls move to N/format", impact: `${dtNames.length} date-time functions`, severity: dtSublist ? "High" : "Medium" });
  if (hasRecovery || hasYield) breakingChanges.push({ change: "Recovery point and yield removed; restructure as Map/Reduce or reschedule", severity: "High" });
  if (/\b(?:var|let|const|function)\s+(?:log|util)\b/.test(clean)) breakingChanges.push({ change: "Variable named log or util collides with reserved globals", severity: "Medium" });
  if (names.has("nlapiCreateError") || objectUsage.some((o) => o.name === "nlobjError")) breakingChanges.push({ change: "nlobjError handling changes to N/error SuiteScriptError", severity: "Medium" });
  if (names.has("nlapiLogExecution")) breakingChanges.push({ change: "nlapiLogExecution becomes log.debug/audit/error with options", impact: `${apis.find(([n]) => n === "nlapiLogExecution")![1]} log calls`, severity: "Low" });

  const testingFocus: string[] = [];
  if (scriptType) testingFocus.push(`Trigger each ${scriptType} entry point and confirm it fires with the expected context`);
  if (sublistNames.length > 0) testingFocus.push("Verify first-line and last-line sublist reads and writes after the 0-based index change");
  if (names.has("nlapiSearchRecord") || names.has("nlapiCreateSearch")) testingFocus.push("Compare search result rows and values against the legacy script output");
  if (names.has("nlapiSendEmail")) testingFocus.push("Confirm emails send with the same recipients, subject and body");
  if (names.has("nlapiRequestURL")) testingFocus.push("Verify outbound HTTP request payloads and response handling");
  if (dtNames.length > 0) testingFocus.push("Check date-time values across timezones at day boundaries");
  if (hasRecovery || hasYield) testingFocus.push("Run a large data set to confirm governance and rescheduling behavior");
  testingFocus.push("Force an error path and confirm catch handling and log output");

  const migrationChecklist = [
    "Add @NApiVersion 2.1 and @NScriptType headers",
    "Build the define() array from the required modules",
    "Convert entry points to receive a context object",
    "Rewrite nlapi calls with options objects",
    ...(sublistNames.length > 0 ? ["Shift sublist indexes to 0-based"] : []),
    ...(unmappedApis.length > 0 ? ["Replace unmapped APIs using the listed workarounds"] : []),
    "Update the script deployment record, deploy to sandbox and run the testing focus",
  ];

  const output: AnalyzeOutput = {
    scriptType,
    entryPoints,
    apiCalls,
    objectUsage,
    requiredModules,
    breakingChanges,
    unmappedApis,
    complexityScore: { ...score, total },
    complexityRating,
    testingFocus,
    migrationChecklist,
    purposeDeterminable: false,
    purposeSummary: null,
    purposeNote: "Mock analyzer: business purpose is not inferred from static pattern counts.",
  };
  return { output, callCount };
}

export class MockAnalyzer implements Analyzer {
  readonly mode = "mock" as const;

  async analyze(input: { fileName: string; source: string }): Promise<AnalyzeResult> {
    const failOn = process.env.MOCK_ANALYZER_FAIL;
    if (failOn && input.fileName.includes(failOn)) {
      throw new AnalysisError("mock_failure", "Mock analyzer failure (MOCK_ANALYZER_FAIL matched).");
    }
    const { output, callCount } = analyzeStatically(input.fileName, input.source);
    return {
      output,
      model: ANALYSIS_MODEL,
      usage: {
        inputTokens: Math.ceil(input.source.length / 4) + 50,
        outputTokens: Math.min(3000, 600 + 40 * callCount),
        cacheReadTokens: PROMPT_TOKEN_ESTIMATE,
        cacheCreationTokens: 0,
      },
    };
  }
}
