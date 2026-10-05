import "server-only";
import type { Analyzer } from "@/lib/types";

// Placeholder so callers compile. The AI-layer milestone replaces this with the
// mock/live implementations. Callers only ever use getAnalyzer().
export function getAnalyzer(): Analyzer {
  throw new Error("Analyzer not implemented yet");
}
