import { beforeEach, describe, expect, it, vi } from "vitest";

// React's cache() memoises per request; make it a passthrough so each call re-reads.
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T>(fn: T) => fn }));

const { getUser, maybeSingle, redirect, notFound } = vi.hoisted(() => {
  // Real Next throws from both redirect and notFound; model that so control flow stops.
  return {
    getUser: vi.fn(),
    maybeSingle: vi.fn(),
    redirect: vi.fn((url: string): never => {
      throw new Error(`REDIRECT:${url}`);
    }),
    notFound: vi.fn((): never => {
      throw new Error("NOT_FOUND");
    }),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));

import { getCurrentUser, isInternal, requireInternal, requireUser } from "@/lib/authz";

const authUser = { id: "u1", email: "auth@example.test" };
const signedIn = (profile: Record<string, unknown> | null) => {
  getUser.mockResolvedValue({ data: { user: authUser } });
  maybeSingle.mockResolvedValue({ data: profile });
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: null } });
});

describe("signed out", () => {
  it("getCurrentUser is null and isInternal false", async () => {
    expect(await getCurrentUser()).toBeNull();
    expect(await isInternal()).toBe(false);
  });

  it("requireUser redirects to /login with encoded next", async () => {
    await expect(requireUser("/tools/a b?x=1")).rejects.toThrow(
      `REDIRECT:/login?next=${encodeURIComponent("/tools/a b?x=1")}`,
    );
  });

  it("requireUser sanitises a hostile next via safeNext", async () => {
    await expect(requireUser("//evil.com")).rejects.toThrow(`REDIRECT:/login?next=${encodeURIComponent("/")}`);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login?next=%2F");
  });

  it("requireInternal calls notFound (not redirect)", async () => {
    await expect(requireInternal()).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("signed in", () => {
  it("public profile: requireInternal calls notFound", async () => {
    signedIn({ id: "u1", email: "p@example.test", role: "public", full_name: null, company_name: null });
    expect(await isInternal()).toBe(false);
    await expect(requireInternal()).rejects.toThrow("NOT_FOUND");
  });

  it("internal profile passes and maps fields", async () => {
    signedIn({ id: "u1", email: "i@example.test", role: "internal", full_name: "Ivy", company_name: "Ethos" });
    expect(await isInternal()).toBe(true);
    await expect(requireInternal()).resolves.toEqual({
      id: "u1",
      email: "i@example.test",
      role: "internal",
      fullName: "Ivy",
      companyName: "Ethos",
    });
    expect(notFound).not.toHaveBeenCalled();
  });

  it("requireUser returns the user when signed in", async () => {
    signedIn({ id: "u1", email: "p@example.test", role: "public", full_name: null, company_name: null });
    await expect(requireUser("/x")).resolves.toMatchObject({ id: "u1", role: "public" });
  });

  it("missing profile row is treated as public, email from auth user", async () => {
    signedIn(null);
    const u = await getCurrentUser();
    expect(u).toMatchObject({ id: "u1", role: "public", email: "auth@example.test", fullName: null, companyName: null });
    await expect(requireInternal()).rejects.toThrow("NOT_FOUND");
  });

  it.each(["admin", "INTERNAL", "", null, 42])("unexpected role %j is treated as public", async (role) => {
    signedIn({ id: "u1", email: "x@example.test", role, full_name: null, company_name: null });
    expect((await getCurrentUser())?.role).toBe("public");
    await expect(requireInternal()).rejects.toThrow("NOT_FOUND");
  });

  it("email falls back to auth user email when profile email is null", async () => {
    signedIn({ id: "u1", email: null, role: "public", full_name: null, company_name: null });
    expect((await getCurrentUser())?.email).toBe("auth@example.test");
  });
});
