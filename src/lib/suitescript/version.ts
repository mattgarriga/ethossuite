import type { ApiVersion } from "@/lib/types";

/**
 * Split source into JSDoc/block comments and code. Line and block comments are
 * removed from the code text (so commented-out nlapi calls don't count) and
 * string literal contents are blanked. Block comments are returned separately
 * because @NApiVersion lives in them.
 */
function splitSource(src: string): { code: string; blockComments: string[] } {
  const blockComments: string[] = [];
  let code = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === "/" && next === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      blockComments.push(src.slice(i, stop));
      code += " ";
      i = stop;
    } else if (c === "/" && next === "/") {
      const end = src.indexOf("\n", i);
      i = end === -1 ? n : end;
    } else if (c === '"' || c === "'") {
      // Single-line strings: stop at the closing quote or the end of the line,
      // so a stray quote inside a regex literal can't swallow the file.
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") {
        if (src[j] === "\\") j++;
        j++;
      }
      code += '""';
      i = j + 1;
    } else if (c === "`") {
      let j = i + 1;
      while (j < n && src[j] !== "`") {
        if (src[j] === "\\") j++;
        j++;
      }
      code += "``";
      i = j + 1;
    } else {
      code += c;
      i++;
    }
  }
  return { code, blockComments };
}

const API_VERSION_TAG = /@NApiVersion\s+(2\.x|2\.0|2\.1)\b/i;
const LEGACY_CALL = /\bnl(?:api|obj)[A-Za-z0-9_]*\s*\(/;

/**
 * Deterministic script version detection (never model-based).
 * - @NApiVersion 2.1 -> "2.1"; 2.0 -> "2.0".
 * - @NApiVersion 2.x counts as "2.0": it is 2.0-era code for deadline purposes
 *   (it must still move to 2.1 by DEADLINES.all).
 * - No tag but nlapi*()/nlobj*() calls -> "1.0".
 * - Otherwise "unknown".
 */
export function detectApiVersion(source: string): ApiVersion {
  const { code, blockComments } = splitSource(source);
  for (const block of blockComments) {
    const m = API_VERSION_TAG.exec(block);
    if (m) return m[1] === "2.1" ? "2.1" : "2.0";
  }
  if (LEGACY_CALL.test(code)) return "1.0";
  return "unknown";
}
