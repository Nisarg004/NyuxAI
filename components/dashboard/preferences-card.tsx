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
  isActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [sectors, setSectors] = useState(props.sectors);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const currentTime = `${pad(props.deliveryHour)}:${pad(props.deliveryMinute)}`;
  const depthLabel = props.depth.charAt(0).toUpperCase() + props.depth.slice(1);

  const toggleSector = (sector: string) => {
    setSectors((prev) => (prev.includes(sector) ? prev.filter((s) => s !== sector) : [...prev, sector]));
  };

  if (!editing) {
    return (
      <section>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-star">Your brief</h2>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="rounded-full px-3 text-aurora hover:text-star">
            Edit
          </Button>
        </div>
        <dl className="mt-3 space-y-2.5 text-sm">
          <div>
            <dt className="text-haze">Topics</dt>
            <dd className="mt-0.5 text-star">{formatSectorList(SECTORS.filter((s) => props.sectors.includes(s)))}</dd>
          </div>
          <div className="flex gap-6">
            <div>
              <dt className="text-haze">Arrives at</dt>
              <dd className="mt-0.5 text-star">{currentTime} your time</dd>
            </div>
            <div>
              <dt className="text-haze">Depth</dt>
              <dd className="mt-0.5 text-star">{depthLabel}</dd>
            </div>
          </div>
        </dl>
        {!props.isActive && (
          <p className="mt-4 rounded-2xl border border-dawn/30 bg-dawn/10 px-3.5 py-2.5 text-sm leading-[1.5] text-dawn">
            Paused: you unsubscribed, so no briefs are being sent. Edit and save to resume.
          </p>
        )}
      </section>
    );
  }

  return (
    <form
      action={async (formData) => {
        await updatePreferences(formData);
        setEditing(false);
      }}
    >
      <h2 className="font-display text-lg font-semibold text-star">Edit your brief</h2>
      <fieldset className="mt-3">
        <legend className="text-sm text-haze">Topics</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SECTORS.map((sector) => {
            const selected = sectors.includes(sector);
            return (
              <button
                key={sector}
                type="button"
                onClick={() => toggleSector(sector)}
                aria-pressed={selected}
                className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                  selected
                    ? "border-dawn bg-dawn font-medium text-night"
                    : "border-line text-haze hover:border-haze hover:text-star"
                }`}
              >
                {sector}
              </button>
            );
          })}
        </div>
      </fieldset>
      {sectors.map((s) => (
        <input key={s} type="hidden" name="sectors" value={s} />
      ))}
      <div className="mt-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-1">
        <div className="space-y-1.5">
          <Label htmlFor="pref-time" className="text-haze">Delivery time</Label>
          <Input id="pref-time" name="time" type="time" defaultValue={currentTime} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pref-timezone" className="text-haze">Timezone</Label>
          <Input id="pref-timezone" name="timezone" type="text" defaultValue={props.timezone} required />
        </div>
      </div>
      {sectors.length === 0 ? (
        <p className="mt-3 text-sm text-alarm">Pick at least one topic.</p>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" disabled={sectors.length === 0}>
          Save
        </Button>
        <Button
          type="button"
          variant="ghost"
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
