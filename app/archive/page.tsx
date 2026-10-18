import { requireUser } from "@/lib/session";
import { getDigestSummaries } from "@/lib/data/digests";
import { Nav } from "@/components/nav";
import { DigestList } from "@/components/archive/digest-list";

export default async function ArchivePage() {
  const { user, preferences } = await requireUser();
  const summaries = await getDigestSummaries(user.id, 50);

  return (
    <>
      <Nav current="archive" isAdmin={user.role === "admin"} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="max-w-2xl">
          <header className="border-b border-ink pb-5">
            <h1 className="font-display text-[2rem] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
              Every edition
            </h1>
            <p className="mt-2 font-display italic text-ink-soft">
              Everything the desk has sent {user.name}, most recent first.
            </p>
          </header>
          <DigestList summaries={summaries} timezone={preferences.timezone} />
        </div>
      </main>
    </>
  );
}
