import {
  cardId,
  deckId,
  factionId,
  operationId,
  playerId,
  type CardDefinition,
  type DeckDefinition,
} from "../../packages/domain/src/index";
import {
  deriveSeed,
  simulateMatch,
} from "../../packages/rules-engine/src/index";
import {
  activatePolicyChanges,
  createPolicyState,
  getActiveBanlist,
  schedulePolicyChange,
  updateMetaState,
  validateDeckForBanlist,
  type SampledMatchResult,
} from "../../packages/sim-core/src/index";
import { createTestWorld } from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

const comboEngineId = cardId("card-restrict-combo-engine");
const comboPayoffId = cardId("card-restrict-combo-payoff");
const replacementId = cardId("card-restrict-replacement");

function unit(
  id: ReturnType<typeof cardId>,
  name: string,
  attack: number,
  health: number,
): CardDefinition {
  return {
    id,
    name,
    type: "UNIT",
    factionId: factionId("fire"),
    rarity: "COMMON",
    cost: 2,
    attack,
    health,
    keywords: [],
    triggers: [],
  };
}

function createScenario(): {
  cards: CardDefinition[];
  comboDeck: DeckDefinition;
  repairedDeck: DeckDefinition;
  opponentDeck: DeckDefinition;
} {
  const comboEngine: CardDefinition = {
    ...unit(comboEngineId, "Assembly Engine", 1, 2),
    cost: 1,
    rarity: "RARE",
    keywords: ["BATTLECRY"],
    triggers: [
      {
        trigger: "ON_PLAY",
        conditions: [],
        effects: [{ type: "SUMMON", tokenCardId: comboPayoffId, amount: 1 }],
      },
    ],
  };
  const payoff = {
    ...unit(comboPayoffId, "Assembly Colossus", 7, 7),
    cost: 8,
    rarity: "LEGENDARY" as const,
  };
  const supporting = Array.from({ length: 8 }, (_, index) =>
    unit(cardId(`card-restrict-support-${index}`), `Support ${index}`, 1, 2),
  );
  const replacement = unit(replacementId, "Underpowered Replacement", 0, 1);
  const opponentCards = Array.from({ length: 10 }, (_, index) =>
    unit(cardId(`card-restrict-opponent-${index}`), `Opponent ${index}`, 3, 3),
  );
  const comboEntries = [comboEngine, payoff, ...supporting].map((card) => ({
    cardId: card.id,
    count: 2 as const,
  }));
  return {
    cards: [comboEngine, payoff, ...supporting, replacement, ...opponentCards],
    comboDeck: {
      id: deckId("deck-restrict-combo-two-copy"),
      name: "Two-copy Combo",
      factionId: factionId("fire"),
      cards: comboEntries,
    },
    repairedDeck: {
      id: deckId("deck-restrict-combo-one-copy"),
      name: "Restricted Combo",
      factionId: factionId("fire"),
      cards: [
        ...comboEntries.map((entry) =>
          entry.cardId === comboEngineId
            ? { ...entry, count: 1 as const }
            : entry,
        ),
        { cardId: replacementId, count: 1 },
      ],
    },
    opponentDeck: {
      id: deckId("deck-restrict-opponent"),
      name: "Opponent",
      factionId: factionId("fire"),
      cards: opponentCards.map((card) => ({ cardId: card.id, count: 2 })),
    },
  };
}

function observedWinRate(
  deck: DeckDefinition,
  opponent: DeckDefinition,
  cards: readonly CardDefinition[],
): number {
  const cardMap = new Map(cards.map((card) => [card.id, card]));
  const matchCount = 200;
  const playerAId = playerId("player-restrict-a");
  const playerBId = playerId("player-restrict-b");
  const samples: SampledMatchResult[] = [];
  for (let sequence = 0; sequence < matchCount; sequence += 1) {
    const testedAsFirstPlayer = sequence % 2 === 0;
    const result = simulateMatch({
      seed: deriveSeed(["restrict-combo", deck.id, sequence]),
      deckA: testedAsFirstPlayer ? deck : opponent,
      deckB: testedAsFirstPlayer ? opponent : deck,
      cards: cardMap,
      strategyA: { aggression: 0.7, value: 0.5, preservation: 0.3 },
      strategyB: { aggression: 0.7, value: 0.5, preservation: 0.3 },
    });
    const deckA = testedAsFirstPlayer ? deck : opponent;
    const deckB = testedAsFirstPlayer ? opponent : deck;
    const winnerIsA = result.winner === "A";
    samples.push({
      sequence,
      playerAId,
      playerBId,
      deckAId: deckA.id,
      deckBId: deckB.id,
      winnerPlayerId: winnerIsA ? playerAId : playerBId,
      winnerDeckId: winnerIsA ? deckA.id : deckB.id,
      loserDeckId: winnerIsA ? deckB.id : deckA.id,
      turns: result.turns,
    });
  }
  const world = createTestWorld(`restrict-meta-${deck.id}`);
  return updateMetaState(world, samples).deckStats[deck.id]!.observedWinRate;
}

describe("restrict combo", () => {
  it("changes legal deck construction and subsequent match performance without a direct win-rate modifier", () => {
    const { cards, comboDeck, repairedDeck, opponentDeck } = createScenario();
    const state = createPolicyState();
    schedulePolicyChange(state, {
      id: operationId("policy-restrict-combo"),
      kind: "RESTRICTION",
      cardId: comboEngineId,
      createdDay: 1,
      timing: "EMERGENCY",
    });
    activatePolicyChanges(state, 2);
    const banlist = getActiveBanlist(state, 2);

    expect(validateDeckForBanlist(comboDeck, cards, banlist).valid).toBe(false);
    expect(validateDeckForBanlist(repairedDeck, cards, banlist).valid).toBe(
      true,
    );

    const unrestrictedPerformance = observedWinRate(
      comboDeck,
      opponentDeck,
      cards,
    );
    const restrictedPerformance = observedWinRate(
      repairedDeck,
      opponentDeck,
      cards,
    );

    expect(unrestrictedPerformance).toBeGreaterThan(restrictedPerformance);
  });
});
