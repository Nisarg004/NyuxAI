import { DateTime } from "luxon";
import { requireUser } from "@/lib/session";
import { getDigestSummaries } from "@/lib/data/digests";
import { getDashboardBrief } from "@/lib/data/dashboard-brief";
import { safeTimezone } from "@/lib/schedule";
import { Nav } from "@/components/nav";
import { NextBriefLine } from "@/components/dashboard/next-brief-line";
import { BriefBody } from "@/components/brief/brief-body";
import { FirstBriefCta } from "@/components/dashboard/first-brief-cta";
import { SendNowPanel } from "@/components/dashboard/send-now-panel";
import { PastBriefs } from "@/components/dashboard/past-briefs";
import { PreferencesCard } from "@/components/dashboard/preferences-card";
import { DeleteAccount } from "@/components/dashboard/delete-account";

function greetingFor(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const { user, preferences } = await requireUser();
  const summaries = await getDigestSummaries(user.id);
  const brief = await getDashboardBrief(user.id, preferences.timezone);
  const inlineId = brief.kind === "none" ? undefined : brief.detail.digest.id;
  const greeting = greetingFor(DateTime.now().setZone(safeTimezone(preferences.timezone)).hour);
  const firstName = user.name.trim().split(/\s+/)[0] ?? user.name;

  return (
    <div className="horizon flex min-h-screen flex-1 flex-col">
      <Nav current="dashboard" isAdmin={user.role === "admin"} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <header className="max-w-3xl">
          <h1 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-bold leading-[0.98] tracking-[-0.035em] text-star">
            {greeting}, {firstName}.
          </h1>
          <div className="mt-4">
            <NextBriefLine
              sectors={preferences.sectors}
              deliveryHour={preferences.deliveryHour}
              deliveryMinute={preferences.deliveryMinute}
              timezone={preferences.timezone}
              nextRunAt={preferences.nextRunAt ? preferences.nextRunAt.toISOString() : null}
            />
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
          <div className="min-w-0">
            {brief.kind === "none" ? (
              <FirstBriefCta />
            ) : (
              <article className="sheet px-5 py-7 sm:px-10 sm:py-10">
                <header className="border-b border-rule pb-6">
                  <p className="text-sm text-ink-soft">
                    {brief.weekday} {brief.dateLabel}
                    {brief.kind === "recent" ? ". Today’s hasn’t been written yet." : ""}
                  </p>
                  <h2 className="mt-2 font-display text-[clamp(1.875rem,4vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.03em] text-ink">
                    {brief.kind === "today" ? "Today’s brief" : "Your most recent brief"}
                  </h2>
                </header>
                <div className="mt-6">
                  <BriefBody
                    editorsNote={brief.detail.editorsNote}
                    itemsBySector={brief.detail.itemsBySector}
                    rejectionsBySector={brief.detail.rejectionsBySector}
                    existingFeedback={brief.detail.existingFeedback}
                  />
                </div>
              </article>
            )}
          </div>

          <aside className="flex min-w-0 flex-col gap-4">
            <div className="panel p-5">
              <PreferencesCard
                sectors={preferences.sectors}
                deliveryHour={preferences.deliveryHour}
                deliveryMinute={preferences.deliveryMinute}
                timezone={preferences.timezone}
                depth={preferences.depth}
                isActive={preferences.isActive}
              />
            </div>

            {brief.kind === "none" ? null : (
              <div className="panel p-5">
                <SendNowPanel />
              </div>
            )}

            <PastBriefs summaries={summaries} excludeId={inlineId} timezone={preferences.timezone} />

            <div className="panel p-5">
              <DeleteAccount />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
