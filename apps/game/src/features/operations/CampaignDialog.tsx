import { useState } from "react";
import {
  CAMPAIGN_DURATIONS,
  CAMPAIGN_TYPES,
  type CampaignDurationDays,
  type CampaignType,
  type PublisherCommand,
} from "../../../../../packages/domain/src/index";

export type CampaignDialogProps = {
  currentDay: number;
  queueCommand: (command: PublisherCommand) => void;
};

export function CampaignDialog({
  currentDay,
  queueCommand,
}: CampaignDialogProps) {
  const [campaignType, setCampaignType] =
    useState<CampaignType>("SOCIAL_MEDIA_ADS");
  const [durationDays, setDurationDays] = useState<CampaignDurationDays>(3);
  const [startDay, setStartDay] = useState(currentDay);
  return (
    <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="font-semibold">Start campaign</h2>
      <label className="block text-sm">
        Campaign
        <select
          aria-label="Campaign type"
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={campaignType}
          onChange={(event) =>
            setCampaignType(event.target.value as CampaignType)
          }
        >
          {CAMPAIGN_TYPES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Duration
        <select
          aria-label="Campaign duration"
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={durationDays}
          onChange={(event) =>
            setDurationDays(Number(event.target.value) as CampaignDurationDays)
          }
        >
          {CAMPAIGN_DURATIONS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Start day
        <input
          aria-label="Campaign start day"
          type="number"
          min={currentDay}
          className="mt-1 block w-full rounded border border-slate-700 bg-slate-950 p-2"
          value={startDay}
          onChange={(event) => setStartDay(Number(event.target.value))}
        />
      </label>
      <button
        type="button"
        className="rounded bg-emerald-400 px-4 py-2 font-semibold text-slate-950"
        onClick={() =>
          queueCommand({
            type: "START_CAMPAIGN",
            campaignType,
            durationDays,
            startDay,
          })
        }
      >
        Queue campaign
      </button>
    </section>
  );
}
