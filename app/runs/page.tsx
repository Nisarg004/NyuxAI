import { requireUser } from "@/lib/session";
import { listRuns } from "@/lib/data/runs";
import { Nav } from "@/components/nav";
import { RunRow } from "@/components/runs/run-row";

export default async function RunsPage() {
  const { preferences } = await requireUser();
  const runs = await listRuns();

  return (
    <>
      <Nav current="runs" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <h1 className="font-display text-2xl text-ink">Runs</h1>
        <p className="mt-1 text-sm text-slate">Every pipeline execution. Click a row for the stage-by-stage log.</p>
        <table className="mt-6 w-full border-collapse rounded-md border border-border bg-white text-left">
          <thead>
            <tr className="border-b border-border bg-paper">
              <th className="px-4 py-2 font-mono text-xs uppercase text-slate">Kind</th>
              <th className="px-4 py-2 font-mono text-xs uppercase text-slate">User</th>
              <th className="px-4 py-2 font-mono text-xs uppercase text-slate">Started</th>
              <th className="px-4 py-2 font-mono text-xs uppercase text-slate">Duration</th>
              <th className="px-4 py-2 font-mono text-xs uppercase text-slate">Status</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <RunRow key={run.id} run={run} timezone={preferences.timezone} />
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
