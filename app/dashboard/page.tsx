import { requireUser } from "@/lib/session";
import { getDigestSummaries } from "@/lib/data/digests";
import { getDashboardBrief } from "@/lib/data/dashboard-brief";
import { Nav } from "@/components/nav";
import { NextBriefLine } from "@/components/dashboard/next-brief-line";
import { BriefBody } from "@/components/brief/brief-body";
import { FirstBriefCta } from "@/components/dashboard/first-brief-cta";
import { SendNowPanel } from "@/components/dashboard/send-now-panel";
import { PastBriefs } from "@/components/dashboard/past-briefs";
import { PreferencesCard } from "@/components/dashboard/preferences-card";

export default async function DashboardPage() {
  const { user, preferences } = await requireUser();
  const summaries = await getDigestSummaries(user.id);
  const brief = await getDashboardBrief(user.id, preferences.timezone);
  const inlineId = brief.kind === "none" ? undefined : brief.detail.digest.id;

  return (
    <>
      <Nav current="dashboard" />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="max-w-2xl">
          <p className="font-display text-sm italic text-ink-soft">{user.name}&rsquo;s desk</p>

          <div className="mt-5">
            <NextBriefLine
              sectors={preferences.sectors}
              deliveryHour={preferences.deliveryHour}
              deliveryMinute={preferences.deliveryMinute}
              timezone={preferences.timezone}
              nextRunAt={preferences.nextRunAt ? preferences.nextRunAt.toISOString() : null}
            />
          </div>

          {brief.kind === "none" ? (
            <div className="mt-4 border-t border-ink">
              <FirstBriefCta />
            </div>
          ) : (
            <div className="mt-3">
              <header className="border-b border-ink pb-5">
                <h1 className="font-display text-[2rem] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">
                  {brief.kind === "today" ? "Today’s brief" : "Your most recent brief"}
                </h1>
                <p className="mt-2 font-display italic text-ink-soft">
                  {brief.weekday} {brief.dateLabel}
                  {brief.kind === "recent" ? " — today’s hasn’t gone to press yet" : ""}
                </p>
              </header>

              <BriefBody
                editorsNote={brief.detail.editorsNote}
                itemsBySector={brief.detail.itemsBySector}
                rejectionsBySector={brief.detail.rejectionsBySector}
                existingFeedback={brief.detail.existingFeedback}
              />

              <div className="mt-6">
                <SendNowPanel />
              </div>
            </div>
          )}

          <div className="mt-12 border-t border-rule pt-6">
            <PastBriefs
              summaries={summaries}
              excludeId={inlineId}
              timezone={preferences.timezone}
            />
          </div>

          <div className="mt-10 border-t border-rule pt-6">
            <PreferencesCard
              sectors={preferences.sectors}
              deliveryHour={preferences.deliveryHour}
              deliveryMinute={preferences.deliveryMinute}
              timezone={preferences.timezone}
              depth={preferences.depth}
            />
          </div>
        </div>
      </main>
    </>
  );
}
