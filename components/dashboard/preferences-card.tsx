"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SECTORS } from "@/lib/sectors";
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
      <div className="rounded-md border border-border bg-white p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">Your preferences</h2>
          <button onClick={() => setEditing(true)} className="text-xs text-slate underline decoration-dotted hover:text-ink">
            Edit
          </button>
        </div>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-slate">Sectors</dt>
            <dd className="flex flex-wrap justify-end gap-1.5">
              {SECTORS.filter((s) => props.sectors.includes(s)).map((s) => (
                <span key={s} className="rounded-sm border border-ink/20 px-1.5 py-0.5 font-mono text-[10px] uppercase text-ink">
                  {s}
                </span>
              ))}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate">Delivery time</dt>
            <dd className="font-mono text-ink">
              {currentTime} ({props.timezone})
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate">Depth</dt>
            <dd className="font-mono capitalize text-ink">{props.depth}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updatePreferences(formData);
        setEditing(false);
      }}
      className="rounded-md border border-amber bg-white p-5"
    >
      <h2 className="font-display text-lg text-ink">Edit preferences</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {SECTORS.map((sector) => (
          <button
            key={sector}
            type="button"
            onClick={() => toggleSector(sector)}
            className={`rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${
              sectors.includes(sector) ? "border-amber bg-ink text-amber" : "border-ink/20 text-ink hover:border-ink"
            }`}
          >
            {sector}
          </button>
        ))}
      </div>
      {sectors.map((s) => (
        <input key={s} type="hidden" name="sectors" value={s} />
      ))}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="pref-time">Delivery time</Label>
          <Input id="pref-time" name="time" type="time" defaultValue={currentTime} required />
        </div>
        <div>
          <Label htmlFor="pref-timezone">Timezone</Label>
          <Input id="pref-timezone" name="timezone" type="text" defaultValue={props.timezone} required />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button type="submit" disabled={sectors.length === 0} className="bg-ink text-paper hover:bg-slate">
          Save
        </Button>
        <Button type="button" variant="outline" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
