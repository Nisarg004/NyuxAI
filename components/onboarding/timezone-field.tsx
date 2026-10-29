"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export function TimezoneField() {
  const [value, setValue] = useState("Asia/Kolkata");

  useEffect(() => {
    // Deliberate mount-time detection: the server can't know the visitor's
    // timezone, so the default renders first and this effect corrects it once
    // client-side Intl is available. See git history for the client-navigation
    // bug this exact pattern fixed — don't restructure without re-checking that.
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (detected) setValue(detected);
    } catch {
      // Intl unsupported — keep the default
    }
  }, []);

  return (
    <Input
      id="timezone"
      name="timezone"
      type="text"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      required
    />
  );
}
