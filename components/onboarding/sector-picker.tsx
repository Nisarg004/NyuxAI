"use client";

import { useState } from "react";
import { SECTORS } from "@/lib/sectors";

export function SectorPicker({ initialSelected = [] }: { initialSelected?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initialSelected);

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
            aria-pressed={selected.includes(sector)}
            className={`h-9 rounded-full border px-4 text-sm font-medium transition-colors ${
              selected.includes(sector)
                ? "border-dawn bg-dawn text-night"
                : "border-line text-haze hover:border-haze hover:text-star"
            }`}
          >
            {sector}
          </button>
        ))}
      </div>
      {selected.map((s) => (
        <input key={s} type="hidden" name="sectors" value={s} />
      ))}
      {selected.length === 0 ? (
        <p className="mt-3 text-sm text-haze">Choose at least one desk.</p>
      ) : null}
    </div>
  );
}
