import { DECK_EVOLUTION_CONFIG, RULES_CONFIG } from "@tcgtycoon/balance";
import type { DeckGenome, PersistentPlayer } from "@tcgtycoon/domain";

export type AdoptionContext = {
  performance: number;
  socialExposure: number;
  tournamentPrestige: number;
  influencerExposure: number;
  novelty: number;
  deckPrice: number;
  missingCardCount: number;
  complexity: number;
};

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function preferenceFit(player: PersistentPlayer, deck: DeckGenome): number {
  const dimensions = ["competitive", "brewer", "casual", "collector"] as const;
  return (
    dimensions.reduce(
      (total, dimension) =>
        total +
        clampUnit(deck.strategy[dimension] ?? 0) * player.motivation[dimension],
      0,
    ) / dimensions.length
  );
}

export function calculateAdoptionScore(
  player: PersistentPlayer,
  deck: DeckGenome,
  context: AdoptionContext,
): number {
  const weights = DECK_EVOLUTION_CONFIG.adoption;
  const positive =
    clampUnit(context.performance) * weights.performanceWeight +
    preferenceFit(player, deck) * weights.preferenceWeight +
    clampUnit(context.socialExposure) * weights.socialExposureWeight +
    clampUnit(context.tournamentPrestige) * weights.tournamentPrestigeWeight +
    clampUnit(context.influencerExposure) * weights.influencerExposureWeight +
    clampUnit(context.novelty) * weights.noveltyWeight;
  const deckCostPressure = clampUnit(
    context.deckPrice / Math.max(1, player.tcgWallet),
  );
  const missingCardPressure = clampUnit(
    context.missingCardCount / RULES_CONFIG.deckSize,
  );
  const complexityPressure =
    clampUnit(context.complexity) * (1 - player.motivation.brewer);
  const penalties =
    deckCostPressure *
      player.motivation.budgetSensitivity *
      weights.deckCostPenaltyWeight +
    missingCardPressure * weights.missingCardPenaltyWeight +
    complexityPressure * weights.complexityPenaltyWeight;

  return clampUnit(positive - penalties);
}
