"use client";

import { useState } from "react";
import { SECTORS } from "@/lib/sectors";

export function SectorPicker() {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (sector: string) => {
    setSelected((prev) => (prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]));
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {SECTORS.map((sector) => (
          <button
            key={sector}
            type="button"
            onClick={() => toggle(sector)}
            className={`rounded-sm border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
              selected.includes(sector) ? "border-amber bg-ink text-amber" : "border-ink/20 text-ink hover:border-ink"
            }`}
          >
            {sector}
          </button>
        ))}
      </div>
      {selected.map((s) => (
        <input key={s} type="hidden" name="sectors" value={s} />
      ))}
      {selected.length === 0 ? <p className="mt-2 text-xs text-destructive">Choose at least one sector.</p> : null}
    </div>
  );
}
