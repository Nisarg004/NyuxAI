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
            aria-pressed={selected.includes(sector)}
            className={`rounded-[3px] border px-3 py-1.5 text-sm transition-colors ${
              selected.includes(sector)
                ? "border-ink bg-ink text-paper"
                : "border-rule text-ink-soft hover:border-ink hover:text-ink"
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
        <p className="mt-2 text-sm text-editor">Choose at least one desk.</p>
      ) : null}
    </div>
  );
}
