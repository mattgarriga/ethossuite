/**
 * Single place for every operational knob. Nothing here is Ethos-specific —
 * branding lives in reporting/brands/.
 */

/**
 * Oracle deprecation milestones. Kept as config rather than inlined so they can
 * be corrected in one place if Oracle moves a date.
 */
export const DEADLINES = {
  /** SuiteScript 1.0 loses support first. */
  ss10: {
    release: '2027.1',
    label: 'NetSuite 2027.1',
    /** Approximate calendar anchor for phasing arithmetic only. */
    approxDate: '2027-03-01',
  },
  /** Everything remaining (2.0 / 2.x) must run on 2.1 by this release. */
  all: {
    release: '2028.2',
    label: 'NetSuite 2028.2',
    approxDate: '2028-08-01',
  },
} as const;

/** Files considered for inventory. */
export const SCRIPT_EXTENSIONS = ['.js'];

/** Directories skipped wholesale during inventory. */
export const IGNORED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '__MACOSX',
  '.svn',
]);

/**
 * Files matching these are recorded but excluded from remediation — converting
 * a vendored library is not this tool's job.
 */
export const EXCLUDE_PATTERNS: Array<{ test: RegExp; reason: string }> = [
  { test: /\.min\.js$/i, reason: 'Minified file — not a maintainable source script' },
  { test: /(^|\/)jquery[.-]/i, reason: 'Third-party library (jQuery)' },
  { test: /(^|\/)(lodash|underscore|moment|handlebars)[.-]/i, reason: 'Third-party library' },
];

export const GUARDRAIL_TEXT = {
  /**
   * Standing header content for the action list — always present, in this
   * order, right after the client/project header. Not conditional on findings.
   */
  sandboxRefresh:
    'Refresh your sandbox account from production before updating any scripts or beginning testing.',
  contactEthos:
    'Based on these findings, contact Ethos Business Solutions for full test plans, implementation support, and script re-architecture where needed.',
  /** Used on the test plan — an internal/technical document, not the client action list. */
  noDeploy:
    'This tool converts and validates scripts. It never deploys them. Validation is a static code check only and is not a substitute for functional testing in a sandbox account.',
  humanReview:
    'Human review and sandbox testing happen after conversion, not instead of it. Every converted script requires developer review and functional sandbox testing before it is promoted to production.',
} as const;
