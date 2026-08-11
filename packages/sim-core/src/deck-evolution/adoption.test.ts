import {
  deckId,
  factionId,
  playerId,
  type DeckGenome,
  type PersistentPlayer,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { calculateAdoptionScore } from "./adoption";

function createPlayer(kind: "COMPETITIVE" | "BUDGET"): PersistentPlayer {
  return {
    id: playerId(`player-${kind.toLowerCase()}`),
    motivation: {
      competitive: kind === "COMPETITIVE" ? 1 : 0.3,
      brewer: 0.2,
      casual: 0.2,
      collector: 0,
      budgetSensitivity: kind === "BUDGET" ? 1 : 0.1,
      whale: 0,
    },
    skill: 0.5,
    loyalty: 0.5,
    tenureDays: 10,
    tcgWallet: kind === "BUDGET" ? 10 : 1_000,
    activity: "ACTIVE",
    collection: {},
    deckIds: [],
    knowledge: { knownCardIds: [], knownDeckIds: [] },
    satisfaction: 0.5,
  };
}

const deck: DeckGenome = {
  id: deckId("deck-adoption"),
  factionId: factionId("fire"),
  cards: [],
  strategy: { competitive: 1, brewer: 0.1, casual: 0.1 },
  originPlayerId: playerId("player-origin"),
  parentDeckIds: [],
  generation: 0,
  createdDay: 1,
};

describe("calculateAdoptionScore", () => {
  it("scores a strong affordable deck above a weak deck for a Competitive player", () => {
    const player = createPlayer("COMPETITIVE");
    const shared = {
      socialExposure: 0.2,
      tournamentPrestige: 0.2,
      influencerExposure: 0.2,
      novelty: 0.5,
      deckPrice: 50,
      missingCardCount: 0,
      complexity: 0.3,
    };

    const strong = calculateAdoptionScore(player, deck, {
      ...shared,
      performance: 0.9,
    });
    const weak = calculateAdoptionScore(player, deck, {
      ...shared,
      performance: 0.25,
    });

    expect(strong).toBeGreaterThan(weak);
  });

  it("materially penalizes an expensive missing-card deck for a Budget player", () => {
    const competitive = createPlayer("COMPETITIVE");
    const budget = createPlayer("BUDGET");
    const accessible = calculateAdoptionScore(competitive, deck, {
      performance: 0.9,
      socialExposure: 0.4,
      tournamentPrestige: 0.4,
      influencerExposure: 0.4,
      novelty: 0.5,
      deckPrice: 50,
      missingCardCount: 0,
      complexity: 0.3,
    });
    const inaccessible = calculateAdoptionScore(budget, deck, {
      performance: 0.9,
      socialExposure: 0.4,
      tournamentPrestige: 0.4,
      influencerExposure: 0.4,
      novelty: 0.5,
      deckPrice: 200,
      missingCardCount: 10,
      complexity: 0.3,
    });

    expect(accessible - inaccessible).toBeGreaterThan(0.2);
  });
});
