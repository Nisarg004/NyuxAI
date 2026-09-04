import { requireUser } from "@/lib/session";
import { getRecentDigests } from "@/lib/data/digests";
import { Nav } from "@/components/nav";
import { CountdownHero } from "@/components/dashboard/countdown-hero";
import { PreferencesCard } from "@/components/dashboard/preferences-card";
import { SendNowPanel } from "@/components/dashboard/send-now-panel";
import { RecentDigests } from "@/components/dashboard/recent-digests";

export default async function DashboardPage() {
  const { user, preferences } = await requireUser();
  const digests = await getRecentDigests(user.id);

  return (
    <>
      <Nav current="dashboard" />
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
        <p className="font-display text-sm italic text-ink-soft">{user.name}&rsquo;s desk</p>

        <div className="mt-8 divide-y divide-rule">
          <div className="pb-8">
            <CountdownHero
              sectors={preferences.sectors}
              deliveryHour={preferences.deliveryHour}
              deliveryMinute={preferences.deliveryMinute}
              timezone={preferences.timezone}
              nextRunAt={preferences.nextRunAt ? preferences.nextRunAt.toISOString() : null}
            />
          </div>
          <div className="py-8">
            <PreferencesCard
              sectors={preferences.sectors}
              deliveryHour={preferences.deliveryHour}
              deliveryMinute={preferences.deliveryMinute}
              timezone={preferences.timezone}
              depth={preferences.depth}
            />
          </div>
          <div className="py-8">
            <RecentDigests digests={digests} timezone={preferences.timezone} />
          </div>
          <div className="pt-8">
            <SendNowPanel />
          </div>
        </div>
      </main>
    </>
  );
}
