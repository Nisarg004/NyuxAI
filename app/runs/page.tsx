import { requireAdmin } from "@/lib/session";
import { listRuns } from "@/lib/data/runs";
import { Nav } from "@/components/nav";
import { RunRow } from "@/components/runs/run-row";

export default async function RunsPage() {
  const { preferences } = await requireAdmin();
  const runs = await listRuns();

  return (
    <div className="horizon flex min-h-screen flex-1 flex-col">
      <Nav current="runs" isAdmin />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <header className="max-w-2xl">
          <h1 className="font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-none tracking-[-0.03em] text-star">
            Runs
          </h1>
          <p className="mt-3 text-[1.0625rem] leading-[1.65] text-haze">
            Every pipeline run, newest first. Open one for the stage-by-stage record.
          </p>
        </header>

        <div className="panel mt-8 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-sm text-haze">
                <th scope="col" className="py-3 pr-4 pl-5 font-medium">Kind</th>
                <th scope="col" className="py-3 pr-4 font-medium">User</th>
                <th scope="col" className="py-3 pr-4 font-medium">Started</th>
                <th scope="col" className="py-3 pr-4 font-medium">Duration</th>
                <th scope="col" className="py-3 pr-4 text-right font-medium">Tokens</th>
                <th scope="col" className="py-3 pr-5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <RunRow key={run.id} run={run} timezone={preferences.timezone} />
              ))}
            </tbody>
          </table>
          {runs.length === 0 ? <p className="px-5 py-6 text-sm text-haze">No runs yet.</p> : null}
        </div>
      </main>
    </div>
  );
}
