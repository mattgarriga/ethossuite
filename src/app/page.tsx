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
    <main>
      <section className="border-b border-line bg-card">
        <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-14 sm:px-6">
          <p className="text-sm font-bold uppercase tracking-wide text-blue2">Ethos Business Solutions</p>
          <h1 className="mt-2 text-4xl font-bold text-navy sm:text-5xl">EthosSuite</h1>
          <p className="mt-3 max-w-xl text-lg text-ink2">
            Tools from Ethos Business Solutions for NetSuite teams.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
        {error ? (
          <p role="alert" className="rounded-card border border-line bg-card p-4 text-ink2">
            Tools are unavailable right now. Please try again shortly.
          </p>
        ) : tools.length === 0 ? (
          <p className="text-mute">No tools are available yet.</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <li key={tool.id}>
                <Link
                  href={`/tools/${tool.slug}`}
                  className="group flex h-full flex-col rounded-card border border-line border-t-4 border-t-blue bg-card p-6 transition hover:-translate-y-0.5 hover:bg-hover hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy2 text-white">
                      <ToolIcon name={tool.icon} className="h-6 w-6" />
                    </span>
                    {tool.status === "beta" && (
                      <span className="rounded-full border border-blue2 px-2 py-0.5 text-xs font-bold text-blue2">
                        Beta
                      </span>
                    )}
                  </div>
                  <h2 className="mt-4 text-xl font-bold text-navy group-hover:text-blue2">{tool.name}</h2>
                  {tool.description && <p className="mt-2 text-ink2">{tool.description}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
