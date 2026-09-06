"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function EmailCapture({ sectors, roleTitle }: { sectors: string[]; roleTitle: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (email.trim()) params.set("email", email.trim());
    if (roleTitle.trim()) params.set("role", roleTitle.trim());
    if (sectors.length) params.set("sectors", sectors.join(","));
    router.push(`/onboarding?${params.toString()}`);
  };

  return (
    <form onSubmit={go} className="mt-14 border-t border-ink pt-6">
      <p className="font-display text-[1.3rem] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
        Get this every day, at a time you pick.
      </p>
      <p className="mt-2 max-w-lg text-[1.0625rem] leading-[1.7] text-ink/90">
        Same four editors, same desks, delivered to your inbox at the hour you actually sit down to read.
        Thumbs up or down on any story and the next edition shifts.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@work.com"
          className="w-64 rounded-[3px]"
        />
        <Button type="submit" className="rounded-[3px] bg-ink px-5 text-paper hover:bg-editor">
          Set up my brief
        </Button>
      </div>
    </form>
  );
}
