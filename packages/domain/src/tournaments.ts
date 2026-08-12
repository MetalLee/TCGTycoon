import type { TournamentId } from "./ids";

export const TOURNAMENT_PRESETS = ["LOCAL", "REGIONAL", "MAJOR"] as const;

export type TournamentPreset = (typeof TOURNAMENT_PRESETS)[number];

export type TournamentSchedule = {
  id: TournamentId;
  name: string;
  preset: TournamentPreset;
  createdDay: number;
  eventDay: number;
};
