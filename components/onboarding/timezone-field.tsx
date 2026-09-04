"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

export function TimezoneField() {
  const [value, setValue] = useState("Asia/Kolkata");

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
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
      className="rounded-[3px]"
    />
  );
}
