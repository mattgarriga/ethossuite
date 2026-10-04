import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { isInternal } from "@/lib/authz";
import { createClient } from "@/lib/supabase/server";

const bandButton =
  "rounded-full border border-white/45 bg-transparent px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/15";

export async function UserMenu() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    return (
      <Link href="/login" className={bandButton}>
        Sign in
      </Link>
    );
  }

  const internal = await isInternal();

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden max-w-48 truncate text-sm text-onband md:inline">{data.user.email}</span>
      {internal && (
        <Link href="/admin" className={bandButton}>
          Admin
        </Link>
      )}
      <form action={signOut}>
        <button type="submit" className={bandButton}>
          Sign out
        </button>
      </form>
    </div>
  );
}
