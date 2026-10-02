import { headers } from "next/headers";

export const MIN_PASSWORD_LENGTH = 10;

// Only allow same-site relative paths, so `next` can't become an open redirect.
export function safeNext(value: FormDataEntryValue | string | null | undefined): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  return value;
}

// Origin used for links inside auth emails. NEXT_PUBLIC_SITE_URL wins when set
// (production); otherwise it is derived from the incoming request.
export async function getOrigin(): Promise<string> {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
