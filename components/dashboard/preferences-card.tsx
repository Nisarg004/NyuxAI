"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTORS } from "@/lib/sectors";
import { formatSectorList } from "@/lib/countdown";
import { updatePreferences } from "@/app/dashboard/actions";

export function PreferencesCard(props: {
  sectors: string[];
  deliveryHour: number;
  deliveryMinute: number;
  timezone: string;
  depth: string;
}) {
  const [editing, setEditing] = useState(false);
  const [sectors, setSectors] = useState(props.sectors);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const currentTime = `${pad(props.deliveryHour)}:${pad(props.deliveryMinute)}`;

  const toggleSector = (sector: string) => {
    setSectors((prev) => (prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]));
  };

  if (!editing) {
    return (
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-sm italic text-ink-soft">Standing instructions</h2>
          <button
            onClick={() => setEditing(true)}
            className="text-sm text-editor underline decoration-editor/40 underline-offset-4 hover:decoration-editor"
          >
            Edit
          </button>
        </div>
        <p className="mt-2 text-[1.0625rem] leading-[1.7] text-ink">
          {formatSectorList(SECTORS.filter((s) => props.sectors.includes(s)))} desks, at{" "}
          {currentTime} your time. <span className="capitalize">{props.depth}</span> depth.
        </p>
      </section>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updatePreferences(formData);
        setEditing(false);
      }}
      className="border-l-2 border-editor pl-4"
    >
      <h2 className="font-display text-sm italic text-ink-soft">Editing standing instructions</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {SECTORS.map((sector) => (
          <button
            key={sector}
            type="button"
            onClick={() => toggleSector(sector)}
            aria-pressed={sectors.includes(sector)}
            className={`rounded-[3px] border px-2.5 py-1 text-sm transition-colors ${
              sectors.includes(sector)
                ? "border-ink bg-ink text-paper"
                : "border-rule text-ink-soft hover:border-ink hover:text-ink"
            }`}
          >
            {sector}
          </button>
        ))}
      </div>
      {sectors.map((s) => (
        <input key={s} type="hidden" name="sectors" value={s} />
      ))}
      <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pref-time" className="text-ink-soft">Delivery time</Label>
          <Input id="pref-time" name="time" type="time" defaultValue={currentTime} required className="rounded-[3px]" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pref-timezone" className="text-ink-soft">Timezone</Label>
          <Input id="pref-timezone" name="timezone" type="text" defaultValue={props.timezone} required className="rounded-[3px]" />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button
          type="submit"
          disabled={sectors.length === 0}
          className="rounded-[3px] bg-ink px-4 text-paper hover:bg-editor"
        >
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-[3px] text-ink-soft hover:text-ink"
          onClick={() => {
            setSectors(props.sectors);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
