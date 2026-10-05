import type { ApiVersion } from "@/lib/types";

// Reimplemented from reference/suitescript-2.1-migrator/src/config.ts.
// Kept as config so a moved Oracle date is a one-place change.
export const DEADLINES = {
  /** SuiteScript 1.0 loses support first. */
  ss10: { release: "2027.1", label: "NetSuite 2027.1", approxDate: "2027-03-01" },
  /** Everything else (2.0 / 2.x / 2.1 / unknown) must be on 2.1 by this release. */
  all: { release: "2028.2", label: "NetSuite 2028.2", approxDate: "2028-08-01" },
} as const;

export type Deadline = { release: string; label: string; approxDate: string };

/** 1.0 gives ss10. Anything else, including "unknown", gives the later "all" deadline. */
export function deadlineFor(apiVersion: ApiVersion): Deadline {
  const d = apiVersion === "1.0" ? DEADLINES.ss10 : DEADLINES.all;
  return { release: d.release, label: d.label, approxDate: d.approxDate };
}
