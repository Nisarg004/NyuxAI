import { requireUser } from "@/lib/session";
import { getRecentDigests } from "@/lib/data/digests";
import { Nav } from "@/components/nav";
import { DigestList } from "@/components/archive/digest-list";

export default async function ArchivePage() {
  const { user, preferences } = await requireUser();
  const digests = await getRecentDigests(user.id, 50);

  return (
    <>
      <Nav current="archive" />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <h1 className="font-display text-2xl text-ink">Archive</h1>
        <p className="mt-1 text-sm text-slate">Every brief you&rsquo;ve been sent, in one place.</p>
        <div className="mt-6">
          <DigestList digests={digests} timezone={preferences.timezone} />
        </div>
      </main>
    </>
  );
}
