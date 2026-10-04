/**
 * Stage 1 — Inventory.
 *
 * Deterministic, static, no agent calls. Parses the JSDoc annotations and falls
 * back to the structural detection algorithm from the Oracle skill when a file
 * carries no @NApiVersion. Cheap enough to run over a whole file cabinet in
 * seconds, which is why it gates the expensive stages that follow.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import {
  EXCLUDE_PATTERNS,
  IGNORED_DIR_NAMES,
  SCRIPT_EXTENSIONS,
} from './config.js';
import type {
  DetectionConfidence,
  InventoryEntry,
  ScriptVersion,
} from './types.js';

const API_VERSION_RE = /@NApiVersion\s+["']?(\d+\.\d+|\d+\.x)["']?/i;
const SCRIPT_TYPE_RE = /@NScriptType\s+([A-Za-z]+)/i;
const NLAPI_RE = /\bnlapi[A-Z]\w*/g;
const NLOBJ_RE = /\bnlobj[A-Z]\w*/g;
const DEFINE_RE = /^\s*define\s*\(/m;
const REQUIRE_RE = /^\s*require\s*\(/m;
const MODERN_JS_RE = /\b(const|let)\s|=>|`[^`]*\$\{/;

/** Walk a directory tree collecting candidate script files. */
export async function collectScriptFiles(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.') continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (IGNORED_DIR_NAMES.has(entry.name)) continue;
        await walk(full);
      } else if (entry.isFile()) {
        const lower = entry.name.toLowerCase();
        if (SCRIPT_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
          found.push(full);
        }
      }
    }
  }

  await walk(root);
  return found.sort();
}

/** Strip string and comment content so annotation scans don't match inside them. */
function stripLineComments(source: string): string {
  return source.replace(/\/\/.*$/gm, '');
}

export interface VersionDetection {
  version: ScriptVersion;
  confidence: DetectionConfidence;
  signals: string[];
}

/**
 * Implements the skill's detection algorithm: trust an explicit @NApiVersion,
 * otherwise infer from the AMD wrapper, legacy global usage, and @NScriptType.
 */
export function detectVersion(source: string): VersionDetection {
  const signals: string[] = [];
  const declared = API_VERSION_RE.exec(source);

  if (declared?.[1]) {
    const raw = declared[1].toLowerCase();
    signals.push(`Explicit @NApiVersion ${raw} in JSDoc header`);
    if (raw === '1.0') {
      return { version: '1.0', confidence: 'definitive', signals };
    }
    if (raw === '2.1') {
      return { version: '2.1', confidence: 'definitive', signals };
    }
    if (raw === '2.0') {
      return { version: '2.0', confidence: 'definitive', signals };
    }
    if (raw === '2.x') {
      return { version: '2.x', confidence: 'definitive', signals };
    }
  }

  // No usable annotation — fall back to structure.
  const body = stripLineComments(source);
  const hasDefine = DEFINE_RE.test(body) || REQUIRE_RE.test(body);
  const nlapiHits = [...new Set(body.match(NLAPI_RE) ?? [])];
  const nlobjHits = [...new Set(body.match(NLOBJ_RE) ?? [])];
  const hasScriptType = SCRIPT_TYPE_RE.test(source);

  signals.push('No @NApiVersion annotation found');

  if (nlapiHits.length > 0 || nlobjHits.length > 0) {
    if (nlapiHits.length > 0) {
      signals.push(
        `Global nlapi* calls present (${nlapiHits.length} unique, e.g. ${nlapiHits
          .slice(0, 3)
          .join(', ')})`,
      );
    }
    if (nlobjHits.length > 0) {
      signals.push(
        `Global nlobj* objects present (${nlobjHits.length} unique, e.g. ${nlobjHits
          .slice(0, 3)
          .join(', ')})`,
      );
    }
    if (!hasDefine) signals.push('No define()/require() AMD wrapper');
    return { version: '1.0', confidence: 'strong', signals };
  }

  if (!hasDefine) {
    signals.push('No define()/require() AMD wrapper');
    if (!hasScriptType) signals.push('No @NScriptType annotation');
    return { version: '1.0', confidence: 'moderate', signals };
  }

  // AMD wrapper but no version tag — a 2.x script missing its annotation.
  signals.push('define()/require() wrapper present but version is unannotated');
  if (MODERN_JS_RE.test(body)) {
    signals.push('Modern JS syntax (const/let, arrow functions or template literals)');
    return { version: '2.x', confidence: 'weak', signals };
  }
  signals.push('ES3/ES5 style only (no const/let, arrow functions or template literals)');
  return { version: '2.0', confidence: 'moderate', signals };
}

function excludeReasonFor(relPath: string): string | null {
  const normalized = relPath.split(sep).join('/');
  for (const rule of EXCLUDE_PATTERNS) {
    if (rule.test.test(normalized)) return rule.reason;
  }
  return null;
}

function idFor(relPath: string): string {
  return relPath.split(sep).join('/').replace(/[^A-Za-z0-9._/-]/g, '_');
}

/** Build the full inventory for an uploaded file cabinet. */
export async function buildInventory(sourceRoot: string): Promise<InventoryEntry[]> {
  const files = await collectScriptFiles(sourceRoot);
  const entries: InventoryEntry[] = [];

  for (const absPath of files) {
    const relPath = relative(sourceRoot, absPath).split(sep).join('/');
    const excludedReason = excludeReasonFor(relPath);

    let source = '';
    let readError: string | null = null;
    try {
      source = await readFile(absPath, 'utf8');
    } catch (err) {
      readError = err instanceof Error ? err.message : String(err);
    }

    if (readError !== null) {
      entries.push({
        id: idFor(relPath),
        relPath,
        fileName: relPath.split('/').pop() ?? relPath,
        sizeBytes: 0,
        lineCount: 0,
        declaredApiVersion: null,
        declaredScriptType: null,
        detectedVersion: 'unknown',
        detectionConfidence: 'weak',
        detectionSignals: [`File could not be read: ${readError}`],
        flagged: false,
        excludedReason: `Unreadable: ${readError}`,
      });
      continue;
    }

    const declaredApiVersion = API_VERSION_RE.exec(source)?.[1] ?? null;
    const declaredScriptType = SCRIPT_TYPE_RE.exec(source)?.[1] ?? null;
    const detection = detectVersion(source);

    entries.push({
      id: idFor(relPath),
      relPath,
      fileName: relPath.split('/').pop() ?? relPath,
      sizeBytes: Buffer.byteLength(source, 'utf8'),
      lineCount: source.split('\n').length,
      declaredApiVersion,
      declaredScriptType,
      detectedVersion: detection.version,
      detectionConfidence: detection.confidence,
      detectionSignals: detection.signals,
      // Anything not already confirmed 2.1 is flagged. Files we deliberately
      // exclude (libraries, minified bundles) stay in the inventory unflagged so
      // the client document's totals still reconcile against the cabinet.
      flagged: excludedReason === null && detection.version !== '2.1',
      excludedReason,
    });
  }

  return entries;
}

export function flaggedEntries(inventory: InventoryEntry[]): InventoryEntry[] {
  return inventory.filter((e) => e.flagged);
}

/** Bucket counts used by both the client summary and the UI. */
export function versionBuckets(inventory: InventoryEntry[]): {
  ss10: number;
  ss20x: number;
  ss21: number;
  unknown: number;
  excluded: number;
} {
  let ss10 = 0;
  let ss20x = 0;
  let ss21 = 0;
  let unknown = 0;
  let excluded = 0;

  for (const e of inventory) {
    if (e.excludedReason !== null) {
      excluded += 1;
      continue;
    }
    switch (e.detectedVersion) {
      case '1.0':
        ss10 += 1;
        break;
      case '2.0':
      case '2.x':
        ss20x += 1;
        break;
      case '2.1':
        ss21 += 1;
        break;
      default:
        unknown += 1;
    }
  }

  return { ss10, ss20x, ss21, unknown, excluded };
}
