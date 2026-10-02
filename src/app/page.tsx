import Link from "next/link";
import { ToolIcon } from "@/components/tool-icon";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  // RLS decides what this visitor can see: signed-out and public users get
  // active/beta public tools, internal staff get everything.
  const { data: tools, error } = await supabase
    .from("tools")
    .select("id, slug, name, description, icon, status")
    .order("sort_order");

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="ring-motif pointer-events-none absolute -right-24 -top-24 h-96 w-96 opacity-80"
      />
      <section className="relative mx-auto w-full max-w-5xl px-6 pb-8 pt-16">
        <h1 className="text-4xl font-bold text-navy sm:text-5xl">EthosSuite</h1>
        <p className="mt-3 max-w-xl text-lg text-neutral-700">
          Tools from Ethos Business Solutions for NetSuite teams.
        </p>
      </section>

      <section className="relative mx-auto w-full max-w-5xl px-6 pb-20">
        {error ? (
          <p role="alert" className="rounded-md border border-line p-4 text-neutral-700">
            Tools are unavailable right now. Please try again shortly.
          </p>
        ) : tools.length === 0 ? (
          <p className="text-neutral-600">No tools are available yet.</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="group flex h-full flex-col rounded-lg border border-line bg-white p-6 transition-colors hover:border-accent"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy text-white">
                      <ToolIcon name={tool.icon} className="h-6 w-6" />
                    </span>
                    {tool.status === "beta" && (
                      <span className="rounded-full border border-accent px-2 py-0.5 text-xs font-semibold text-accent">
                        Beta
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-navy group-hover:text-accent">
                    {tool.name}
                  </h2>
                  {tool.description && (
                    <p className="mt-2 text-neutral-700">{tool.description}</p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
