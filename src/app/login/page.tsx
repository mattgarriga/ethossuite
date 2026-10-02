import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeNext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Sign in | EthosSuite" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(next);

  const initialError =
    params.error === "link"
      ? "That link is invalid or has expired. Request a new one below."
      : undefined;

  return (
    <main className="mx-auto flex w-full max-w-5xl justify-center px-6 py-16">
      <AuthForm next={next} initialError={initialError} />
    </main>
  );
}
