import { useState } from "react";
import { TOURNAMENT_CONFIG } from "../../../../../packages/balance/src/index";
import {
  tournamentId,
  TOURNAMENT_PRESETS,
  type PublisherCommand,
  type TournamentPreset,
} from "../../../../../packages/domain/src/index";

export type TournamentCreateDialogProps = {
  currentDay: number;
  queueCommand: (command: PublisherCommand) => void;
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function TournamentCreateDialog({
  currentDay,
  queueCommand,
}: TournamentCreateDialogProps) {
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<TournamentPreset>("LOCAL");
  const [eventDay, setEventDay] = useState(currentDay + 2);
  const minimumEventDay = currentDay + TOURNAMENT_CONFIG[preset].prepDays;
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="font-semibold">Schedule tournament</h2>
      <label className="block text-sm">
        Name
        <input
          aria-label="Tournament name"
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        Preset
        <select
          aria-label="Tournament preset"
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={preset}
          onChange={(event) => {
            const nextPreset = event.target.value as TournamentPreset;
            setPreset(nextPreset);
            setEventDay((day) =>
              Math.max(
                day,
                currentDay + TOURNAMENT_CONFIG[nextPreset].prepDays,
              ),
            );
          }}
        >
          {TOURNAMENT_PRESETS.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Event day
        <input
          aria-label="Event day"
          type="number"
          min={minimumEventDay}
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={eventDay}
          onChange={(event) => setEventDay(Number(event.target.value))}
        />
      </label>
      <button
        type="button"
        disabled={
          !name.trim() ||
          !Number.isInteger(eventDay) ||
          eventDay < minimumEventDay
        }
        className="rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-40"
        onClick={() =>
          queueCommand({
            type: "CREATE_TOURNAMENT",
            tournamentId: tournamentId(`tournament-${eventDay}-${slug(name)}`),
            name: name.trim(),
            preset,
            eventDay,
          })
        }
      >
        Queue tournament
      </button>
    </section>
  );
}
