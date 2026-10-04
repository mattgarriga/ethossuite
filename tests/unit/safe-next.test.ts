import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { safeNext } from "@/lib/auth";

describe("safeNext", () => {
  it.each([
    ["/", "/"],
    ["/tools/x", "/tools/x"],
    ["/tools/x?a=1#h", "/tools/x?a=1#h"],
  ])("allows same-site path %j", (input, out) => {
    expect(safeNext(input)).toBe(out);
  });

  it.each([
    ["protocol-relative", "//evil.com"],
    ["backslash", "/\\evil"],
    ["backslash mid-path", "/a\\b"],
    ["absolute url", "https://evil.com"],
    ["javascript scheme", "javascript:alert(1)"],
    ["relative without slash", "tools/x"],
    ["empty", ""],
  ])("rejects %s", (_n, input) => {
    expect(safeNext(input)).toBe("/");
  });

  it("falls back for null and undefined", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });

  it("falls back for a non-string FormDataEntryValue (File)", () => {
    const file = new File(["x"], "x.txt");
    expect(safeNext(file)).toBe("/");
  });
});
