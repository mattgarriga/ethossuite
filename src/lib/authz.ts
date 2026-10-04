// TEMPORARY STUB (frontend-dev, M1). Replaced by backend-dev's real implementation at merge.
// Signatures match the agreed contract exactly.
import { notFound } from "next/navigation";

export type CurrentUser = {
  id: string;
  email: string | null;
  role: "public" | "internal";
  fullName: string | null;
  companyName: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return null;
}

export async function isInternal(): Promise<boolean> {
  return false;
}

export async function requireUser(next?: string): Promise<CurrentUser> {
  void next;
  notFound();
}

export async function requireInternal(): Promise<CurrentUser> {
  notFound();
}
