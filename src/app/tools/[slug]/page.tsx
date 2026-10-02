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
    <main className="mx-auto w-full max-w-5xl px-6 py-16">
      <Link href="/" className="text-sm font-semibold text-accent hover:underline">
        &larr; All tools
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-navy">{tool.name}</h1>
      {tool.description && (
        <p className="mt-3 max-w-2xl text-lg text-neutral-700">{tool.description}</p>
      )}
      <p className="mt-8 rounded-md border border-line p-4 text-neutral-700">
        This tool is not live yet.
      </p>
    </main>
  );
}
