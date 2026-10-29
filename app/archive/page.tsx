import { requireUser } from "@/lib/session";
import { getDigestSummaries } from "@/lib/data/digests";
import { Nav } from "@/components/nav";
import { DigestList } from "@/components/archive/digest-list";

export default async function ArchivePage() {
  const { user, preferences } = await requireUser();
  const summaries = await getDigestSummaries(user.id, 50);

  return (
    <div className="horizon flex min-h-screen flex-1 flex-col">
      <Nav current="archive" isAdmin={user.role === "admin"} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <header>
          <h1 className="font-display text-[clamp(2rem,4vw,3.25rem)] font-bold leading-none tracking-[-0.03em] text-star">
            Past briefs
          </h1>
          <p className="mt-3 text-[1.0625rem] leading-[1.65] text-haze">
            Everything Nyux has written for {user.name}, newest first.
          </p>
        </header>
        <div className="panel mt-8 p-2 sm:p-3">
          <DigestList summaries={summaries} timezone={preferences.timezone} />
        </div>
      </main>
    </div>
  );
}
