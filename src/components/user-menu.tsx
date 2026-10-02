import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";

export async function UserMenu() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <Link
        href="/login"
        className="rounded-md border border-navy px-4 py-1.5 text-sm font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden max-w-48 truncate text-neutral-700 sm:inline">{data.user.email}</span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-navy px-4 py-1.5 font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
