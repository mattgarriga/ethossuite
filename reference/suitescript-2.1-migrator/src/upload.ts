/**
 * Accepting a client's file cabinet.
 *
 * Two shapes are supported because neither covers every case: a browser folder
 * drop (`webkitdirectory`, which sends each file with its relative path as the
 * part filename) and a .zip. A server-side path picker is deliberately not
 * offered — the tool runs as one shared instance, so a path on the server is
 * meaningless to a teammate using it from their own machine.
 */

import AdmZip from 'adm-zip';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { IGNORED_DIR_NAMES } from '../core/config.js';

export interface UploadOutcome {
  written: number;
  skipped: string[];
}

/**
 * Resolve `relPath` inside `root`, refusing anything that escapes it. Guards
 * against both crafted multipart filenames and zip-slip entries.
 */
function safeJoin(root: string, relPath: string): string | null {
  const cleaned = relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (cleaned.length === 0) return null;

  const target = resolve(root, normalize(cleaned));
  if (target !== root && !target.startsWith(root + sep)) return null;
  return target;
}

function isIgnored(relPath: string): boolean {
  return relPath
    .split('/')
    .some((segment) => IGNORED_DIR_NAMES.has(segment) || segment === '__MACOSX');
}

/** Extract a zipped file cabinet into `sourceRoot`. */
export async function extractZip(buffer: Buffer, sourceRoot: string): Promise<UploadOutcome> {
  const zip = new AdmZip(buffer);
  const skipped: string[] = [];
  let written = 0;

  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;

    const relPath = entry.entryName.replace(/\\/g, '/');
    if (isIgnored(relPath) || relPath.split('/').pop()?.startsWith('.')) {
      continue;
    }

    const target = safeJoin(sourceRoot, relPath);
    if (target === null) {
      skipped.push(`${relPath} (path escapes the upload directory)`);
      continue;
    }

    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, entry.getData());
    written += 1;
  }

  return { written, skipped };
}

/** Write a single file from a folder-drop upload. */
export async function writeUploadedFile(
  sourceRoot: string,
  relPath: string,
  data: Buffer,
): Promise<string | null> {
  if (isIgnored(relPath)) return null;

  const target = safeJoin(sourceRoot, relPath);
  if (target === null) return `${relPath} (path escapes the upload directory)`;

  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  return null;
}

export function isZipName(name: string): boolean {
  return name.toLowerCase().endsWith('.zip');
}

export { safeJoin as resolveWithinRoot };
export const uploadTargetFor = (sourceRoot: string, relPath: string): string =>
  join(sourceRoot, relPath);
