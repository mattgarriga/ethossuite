import { requireInternal } from "@/lib/authz";

export const metadata = { title: "Admin | EthosSuite" };

const SECTIONS = ["Runs & costs", "Leads", "Settings"];

export default async function AdminPage() {
  const user = await requireInternal();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-navy">Admin</h1>
      <p className="mt-2 text-ink2">Signed in as {user.fullName ?? user.email ?? "staff"}</p>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((name) => (
          <li key={name} className="rounded-card border border-line bg-card p-6">
            <h2 className="text-xl font-bold text-navy">{name}</h2>
            <p className="mt-2 text-mute">Coming in a later milestone</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
