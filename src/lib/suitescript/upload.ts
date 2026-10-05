export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 256 * 1024;
export const MAX_FILE_NAME_LENGTH = 200;

// Reimplemented from reference config.ts EXCLUDE_PATTERNS: vendored or minified
// code isn't a maintainable source script.
export const EXCLUDE_PATTERNS: Array<{ test: RegExp; reason: string }> = [
  { test: /\.min\.js$/i, reason: "Minified file, not a maintainable source script" },
  { test: /(^|\/)jquery[.-]/i, reason: "Third-party library (jQuery)" },
  { test: /(^|\/)(lodash|underscore|moment|handlebars)[.-]/i, reason: "Third-party library" },
];

export type UploadResult =
  | { ok: true; fileName: string; source: string }
  | { ok: false; message: string };

/**
 * Safe stored file name: basename only; path separators, control characters
 * and ".." removed; capped at 200 chars (the extension is preserved).
 */
export function sanitizeFileName(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() ?? "";
  let cleaned = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/[/\\]/g, "")
    .trim()
    .replace(/^\.+/, "");
  if (cleaned.length > MAX_FILE_NAME_LENGTH) {
    const ext = cleaned.toLowerCase().endsWith(".js") ? cleaned.slice(-3) : "";
    cleaned = cleaned.slice(0, MAX_FILE_NAME_LENGTH - ext.length) + ext;
  }
  return cleaned;
}

export function validateUpload(name: string, bytes: Uint8Array): UploadResult {
  const fileName = sanitizeFileName(name);
  if (!fileName || fileName.toLowerCase() === ".js") {
    return { ok: false, message: "The file needs a name." };
  }
  if (!fileName.toLowerCase().endsWith(".js")) {
    return { ok: false, message: "Only .js files are accepted." };
  }
  if (bytes.byteLength === 0) {
    return { ok: false, message: "The file is empty." };
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { ok: false, message: `The file is larger than the ${MAX_FILE_BYTES / 1024} KB limit.` };
  }
  for (const rule of EXCLUDE_PATTERNS) {
    if (rule.test.test(fileName)) {
      return { ok: false, message: `This file can't be assessed: ${rule.reason}.` };
    }
  }
  if (bytes.includes(0)) {
    return { ok: false, message: "The file looks like a binary file, not a script." };
  }
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, message: "The file is not valid UTF-8 text." };
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  if (text.trim().length === 0) {
    return { ok: false, message: "The file is empty." };
  }
  return { ok: true, fileName, source: text };
}
