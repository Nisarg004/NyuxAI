import { submitOnboarding } from "./actions";
import { SectorPicker } from "@/components/onboarding/sector-picker";
import { TimezoneField } from "@/components/onboarding/timezone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function OnboardingPage() {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-6 py-16">
      <h1 className="font-display text-4xl font-semibold leading-none tracking-[-0.02em] text-ink">Brieff</h1>
      <p className="mt-3 font-display text-lg italic text-ink-soft">
        Tell the desk what to watch and when you read.
      </p>

      <form action={submitOnboarding} className="mt-10 space-y-6">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-ink-soft">Email</Label>
          <Input id="email" name="email" type="email" required className="rounded-[3px]" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-ink-soft">Name</Label>
          <Input id="name" name="name" type="text" required className="rounded-[3px]" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="roleTitle" className="text-ink-soft">What you do</Label>
          <Input
            id="roleTitle"
            name="roleTitle"
            type="text"
            placeholder="e.g. Product manager"
            className="rounded-[3px]"
          />
          <p className="text-sm text-ink-soft">
            The writer uses this to frame why each story matters to you.
          </p>
        </div>
        <div className="space-y-2">
          <Label className="text-ink-soft">Desks to follow</Label>
          <SectorPicker />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="time" className="text-ink-soft">Delivery time</Label>
            <Input id="time" name="time" type="time" defaultValue="20:00" required className="rounded-[3px]" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-ink-soft">Timezone</Label>
            <TimezoneField />
          </div>
        </div>
        <Button type="submit" className="w-full rounded-[3px] bg-ink text-paper hover:bg-editor">
          Start my briefing
        </Button>
      </form>
    </main>
  );
}
