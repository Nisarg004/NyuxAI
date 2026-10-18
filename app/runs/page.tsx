import { requireAdmin } from "@/lib/session";
import { listRuns } from "@/lib/data/runs";
import { Nav } from "@/components/nav";
import { RunRow } from "@/components/runs/run-row";

export default async function RunsPage() {
  const { preferences } = await requireAdmin();
  const runs = await listRuns();

  return (
    <>
      <Nav current="runs" isAdmin />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <header className="max-w-2xl border-b border-ink pb-5">
          <h1 className="font-display text-[2rem] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
            The newsroom log
          </h1>
          <p className="mt-2 font-display italic text-ink-soft">
            Every pipeline run, most recent first. Open one for the stage-by-stage record.
          </p>
        </header>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-ink text-sm text-ink-soft">
                <th className="py-2 pr-4 font-normal">Kind</th>
                <th className="py-2 pr-4 font-normal">User</th>
                <th className="py-2 pr-4 font-normal">Started</th>
                <th className="py-2 pr-4 font-normal">Duration</th>
                <th className="py-2 pr-0 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <RunRow key={run.id} run={run} timezone={preferences.timezone} />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}
