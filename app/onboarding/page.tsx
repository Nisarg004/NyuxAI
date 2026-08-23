import { submitOnboarding } from "./actions";
import { SectorPicker } from "@/components/onboarding/sector-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <h1 className="font-display text-3xl text-ink">Set up your brief</h1>
      <p className="mt-1 text-sm text-slate">One brief, timed to when you actually read.</p>

      <form action={submitOnboarding} className="mt-8 space-y-5">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" type="text" required />
        </div>
        <div>
          <Label htmlFor="roleTitle">Role</Label>
          <Input id="roleTitle" name="roleTitle" type="text" placeholder="e.g. Product manager" />
        </div>
        <div>
          <Label>Sectors</Label>
          <div className="mt-1.5">
            <SectorPicker />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="time">Delivery time</Label>
            <Input id="time" name="time" type="time" defaultValue="20:00" required />
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              name="timezone"
              type="text"
              defaultValue="Asia/Kolkata"
              data-detect-timezone
            />
          </div>
        </div>
        <Button type="submit" className="w-full bg-ink text-paper hover:bg-slate">
          Start my briefing
        </Button>
      </form>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener("DOMContentLoaded", function () {
              var el = document.querySelector('[data-detect-timezone]');
              if (el && !el.value) {
                try { el.value = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
              }
            });
          `,
        }}
      />
    </main>
  );
}
