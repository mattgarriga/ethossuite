import { redirect } from "next/navigation";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Reset password | EthosSuite" };

// Reached from the emailed reset link, after /auth/callback has created a session.
export default async function ResetPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?error=link");

  return (
    <main className="mx-auto flex w-full max-w-5xl justify-center px-4 py-12 sm:px-6">
      <ResetPasswordForm />
    </main>
  );
}
