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
    <form onSubmit={go} className="panel mt-6 p-6 sm:p-8">
      <p className="font-display text-2xl font-bold leading-[1.15] tracking-[-0.03em] text-star">
        Get this every day, at the hour you read.
      </p>
      <p className="mt-2 max-w-lg text-[0.975rem] leading-[1.6] text-haze">
        Same desks, same four agents, in your inbox each morning. Thumbs up or down on any story and the next
        brief adjusts.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <label htmlFor="capture-email" className="sr-only">
          Email address
        </label>
        <Input
          id="capture-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@work.com"
          className="sm:max-w-xs"
        />
        <Button type="submit" size="lg">
          Send me this daily
        </Button>
      </div>
    </form>
  );
}
