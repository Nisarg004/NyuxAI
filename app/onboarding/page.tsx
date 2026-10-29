import Link from "next/link";
import { submitOnboarding } from "./actions";
import { Logo } from "@/components/brand/logo";
import { SectorPicker } from "@/components/onboarding/sector-picker";
import { TimezoneField } from "@/components/onboarding/timezone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTORS } from "@/lib/sectors";

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; role?: string; sectors?: string }>;
}) {
  const sp = await searchParams;
  const prefillEmail = typeof sp.email === "string" ? sp.email : "";
  const prefillRole = typeof sp.role === "string" ? sp.role : "";
  const prefillSectors = (typeof sp.sectors === "string" ? sp.sectors.split(",") : [])
    .map((s) => s.trim())
    .filter((s) => (SECTORS as readonly string[]).includes(s));

  return (
    <main className="horizon flex-1">
      <div className="mx-auto w-full max-w-xl px-4 py-10 sm:px-6 sm:py-14">
        <Link href="/" aria-label="Nyux home" className="inline-flex text-xl text-star">
          <Logo />
        </Link>

        <h1 className="mt-12 font-display text-[clamp(2.25rem,6vw,3.25rem)] font-bold leading-[0.95] tracking-[-0.035em] text-star">
          Set up your brief
        </h1>
        <p className="mt-4 max-w-[46ch] text-[1.0625rem] leading-relaxed text-haze">
          Tell us what to watch and when you read. We build it overnight and send it at your time.
        </p>

        <form action={submitOnboarding} className="panel mt-10 space-y-7 p-5 sm:p-8">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-star">
              Email
            </Label>
            <Input id="email" name="email" type="email" required defaultValue={prefillEmail} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name" className="text-star">
              Name
            </Label>
            <Input id="name" name="name" type="text" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="roleTitle" className="text-star">
              What you do
            </Label>
            <Input
              id="roleTitle"
              name="roleTitle"
              type="text"
              defaultValue={prefillRole}
              placeholder="For example, product manager"
            />
            <p className="text-sm text-haze">We use this to explain why each story matters to your work.</p>
          </div>
          <div className="space-y-3">
            <Label className="text-star">Desks to follow</Label>
            <SectorPicker initialSelected={prefillSectors} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="time" className="text-star">
                Delivery time
              </Label>
              <Input id="time" name="time" type="time" defaultValue="20:00" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone" className="text-star">
                Timezone
              </Label>
              <TimezoneField />
            </div>
          </div>
          <div className="space-y-4 pt-1">
            <Button type="submit" size="lg" className="w-full">
              Start my brief
            </Button>
            <p className="text-sm text-haze">
              By continuing you agree to the{" "}
              <Link href="/terms" className="text-aurora underline underline-offset-4 hover:text-star">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-aurora underline underline-offset-4 hover:text-star">
                Privacy policy
              </Link>
              .
            </p>
          </div>
        </form>

        <p className="mt-8 text-sm text-haze">
          Already have an account?{" "}
          <Link href="/signin" className="text-aurora underline underline-offset-4 hover:text-star">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
