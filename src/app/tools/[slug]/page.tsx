import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Placeholder tool page. Each tool will get its own module here; for now this
// proves the tile -> route link and that RLS hides tools the visitor can't see.
export default async function ToolPage({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: tool } = await supabase
    .from("tools")
    .select("name, description")
    .eq("slug", slug)
    .maybeSingle();

  if (!tool) notFound();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm font-bold text-blue2 hover:underline">
        &larr; All tools
      </Link>
      <div className="mt-4 rounded-card border border-line border-t-4 border-t-blue bg-card p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-navy">{tool.name}</h1>
        {tool.description && <p className="mt-3 max-w-2xl text-lg text-ink2">{tool.description}</p>}
        <p className="mt-8 rounded-field border border-line bg-soft p-4 text-ink2">
          This tool is not live yet.
        </p>
      </div>
    </main>
  );
}
