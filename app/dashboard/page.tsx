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
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-8">
        <CountdownHero
          sectors={preferences.sectors}
          deliveryHour={preferences.deliveryHour}
          deliveryMinute={preferences.deliveryMinute}
          timezone={preferences.timezone}
          nextRunAt={preferences.nextRunAt ? preferences.nextRunAt.toISOString() : null}
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <PreferencesCard
            sectors={preferences.sectors}
            deliveryHour={preferences.deliveryHour}
            deliveryMinute={preferences.deliveryMinute}
            timezone={preferences.timezone}
            depth={preferences.depth}
          />
          <RecentDigests digests={digests} timezone={preferences.timezone} />
        </div>
        <SendNowPanel userId={user.id} />
      </main>
    </>
  );
}
