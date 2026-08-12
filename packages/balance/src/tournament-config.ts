export type TournamentPresetConfig = {
  maxPlayers: number;
  prepDays: number;
  cashCost: number;
};

type TournamentPreset = "LOCAL" | "REGIONAL" | "MAJOR";

export const TOURNAMENT_CONFIG = {
  LOCAL: { maxPlayers: 32, prepDays: 2, cashCost: 2_000 },
  REGIONAL: { maxPlayers: 128, prepDays: 5, cashCost: 7_500 },
  MAJOR: { maxPlayers: 512, prepDays: 10, cashCost: 20_000 },
} as const satisfies Readonly<Record<TournamentPreset, TournamentPresetConfig>>;

export const TOURNAMENT_PUBLICITY_CONFIG = {
  topCutSize: 8,
  minimumPlacementMultiplier: 0.25,
  byPreset: {
    LOCAL: { socialExposure: 0.25, tournamentPrestige: 0.2 },
    REGIONAL: { socialExposure: 0.6, tournamentPrestige: 0.6 },
    MAJOR: { socialExposure: 1, tournamentPrestige: 1 },
  },
} as const satisfies {
  topCutSize: number;
  minimumPlacementMultiplier: number;
  byPreset: Readonly<
    Record<
      TournamentPreset,
      { socialExposure: number; tournamentPrestige: number }
    >
  >;
};
