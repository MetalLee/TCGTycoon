import {
  cardId,
  deckId,
  expansionId,
  factionId,
  playerId,
  printingId,
  type CardDefinition,
  type DeckGenome,
  type PersistentPlayer,
  type WorldState,
} from "../../packages/domain/src/index";
import { DeterministicRng } from "../../packages/rules-engine/src/index";
import {
  createInitialWorldMetrics,
  sampleDailyMatches,
  updateMetaState,
} from "../../packages/sim-core/src/index";
import { describe, expect, it } from "vitest";

function createPlayer(
  id: string,
  deck: DeckGenome,
  activity: PersistentPlayer["activity"],
): PersistentPlayer {
  return {
    id: playerId(id),
    motivation: {
      competitive: 0.5,
      brewer: id === "player-brewer" ? 1 : 0.1,
      casual: 0.4,
      collector: 0,
      budgetSensitivity: 0.2,
      whale: 0,
    },
    skill: 0.5,
    loyalty: 0.5,
    tenureDays: 10,
    tcgWallet: 100,
    activity,
    collection: {},
    deckIds: [deck.id],
    knowledge: {
      knownCardIds: deck.cards.map((entry) => entry.cardId),
      knownDeckIds: [deck.id],
    },
    satisfaction: 0.6,
  };
}

function createCards(
  prefix: string,
  faction: "fire" | "machine",
  strong: boolean,
): CardDefinition[] {
  return Array.from({ length: 10 }, (_, index) => ({
    id: cardId(`card-${prefix}-${index + 1}`),
    name: `${prefix} ${index + 1}`,
    type: "UNIT" as const,
    factionId: factionId(faction),
    rarity: "COMMON" as const,
    cost: 1,
    attack: strong ? 3 : 1,
    health: strong ? 3 : 1,
    keywords: [],
    triggers: strong
      ? [
          {
            trigger: "ON_PLAY" as const,
            conditions: [],
            effects: [
              {
                type: "DEAL_DAMAGE" as const,
                amount: 1,
                target: "ENEMY_HERO" as const,
              },
            ],
          },
        ]
      : [],
  }));
}

function createGenome(
  id: string,
  cards: readonly CardDefinition[],
  ownerId: string,
): DeckGenome {
  return {
    id: deckId(id),
    factionId: cards[0]!.factionId,
    cards: cards.map((card) => ({ cardId: card.id, count: 2 })),
    strategy: {
      competitive: 0.7,
      brewer: 0.5,
      casual: 0.4,
      collector: 0,
    },
    originPlayerId: playerId(ownerId),
    parentDeckIds: [],
    generation: 0,
    createdDay: 1,
  };
}

function createHiddenComboWorld(): {
  hiddenDeck: DeckGenome;
  observer: PersistentPlayer;
  opponent: PersistentPlayer;
  world: WorldState;
} {
  const hiddenCards = createCards("hidden-combo", "fire", true);
  const publicCards = createCards("public-baseline", "machine", false);
  const hiddenDeck = createGenome(
    "deck-hidden-combo",
    hiddenCards,
    "player-brewer",
  );
  const publicDeck = createGenome(
    "deck-public-baseline",
    publicCards,
    "player-opponent",
  );
  const brewer = createPlayer("player-brewer", hiddenDeck, "ACTIVE");
  const opponent = createPlayer("player-opponent", publicDeck, "ACTIVE");
  const observer = createPlayer("player-observer", publicDeck, "CHURNED");
  const allCards = [...hiddenCards, ...publicCards];
  const printings = allCards.map((card) => ({
    id: printingId(`printing-${card.id}`),
    cardId: card.id,
    expansionId: expansionId("set-discovery"),
  }));

  for (const printing of printings) {
    if (hiddenCards.some((card) => card.id === printing.cardId)) {
      brewer.collection[printing.id] = 2;
    } else {
      opponent.collection[printing.id] = 2;
      observer.collection[printing.id] = 2;
    }
  }

  return {
    hiddenDeck,
    observer,
    opponent,
    world: {
      schemaVersion: 3,
      simulationVersion: "1",
      ruleVersion: "1",
      balanceVersion: "1",
      worldSeed: "hidden-combo-discovery",
      day: 1,
      status: "LIVE",
      cards: Object.fromEntries(allCards.map((card) => [card.id, card])),
      printings: Object.fromEntries(
        printings.map((printing) => [printing.id, printing]),
      ),
      expansions: {
        "set-discovery": {
          id: expansionId("set-discovery"),
          name: "Discovery Set",
        },
      },
      products: {},
      printRuns: {},
      players: {
        [brewer.id]: brewer,
        [opponent.id]: opponent,
        [observer.id]: observer,
      },
      agents: {},
      decks: {
        [hiddenDeck.id]: hiddenDeck,
        [publicDeck.id]: publicDeck,
      },
      cohorts: [],
      market: { listings: [], snapshots: {} },
      meta: { deckStats: {}, matchups: {} },
      metrics: createInitialWorldMetrics({
        potential: 0,
        interested: 0,
        newByAge: [0, 0, 0, 0, 0, 0, 0],
        active: 2,
        atRisk: 0,
        churned: 1,
        returning: 0,
      }),
      cash: { balance: 0, ledger: [] },
      history: { events: [] },
    },
  };
}

describe("hidden combo discovery", () => {
  it("spreads a hidden strong deck only through repeated actual match exposure", () => {
    const { hiddenDeck, observer, opponent, world } = createHiddenComboWorld();
    const initiallyInformed = Object.values(world.players).filter((player) =>
      player.knowledge.knownDeckIds.includes(hiddenDeck.id),
    );

    expect(initiallyInformed.map((player) => player.id)).toEqual([
      playerId("player-brewer"),
    ]);
    expect(opponent.knowledge.knownDeckIds).not.toContain(hiddenDeck.id);
    expect(observer.knowledge.knownDeckIds).not.toContain(hiddenDeck.id);

    const samples = sampleDailyMatches(world, new DeterministicRng(77n));
    const repeatedSamples = sampleDailyMatches(
      structuredClone(world),
      new DeterministicRng(77n),
    );

    expect(samples).toEqual(repeatedSamples);
    expect(samples.length).toBeGreaterThan(1);
    expect(samples.length).toBeLessThan(25);
    expect(samples.every((sample) => sample.turns > 0)).toBe(true);
    expect(
      samples.filter((sample) => sample.winnerDeckId === hiddenDeck.id).length,
    ).toBeGreaterThan(samples.length / 2);

    const result = updateMetaState(world, samples);
    const informedAfterMatches = Object.values(world.players).filter((player) =>
      player.knowledge.knownDeckIds.includes(hiddenDeck.id),
    );

    expect(informedAfterMatches.map((player) => player.id).sort()).toEqual([
      playerId("player-brewer"),
      playerId("player-opponent"),
    ]);
    expect(observer.knowledge.knownDeckIds).not.toContain(hiddenDeck.id);
    expect(
      result.knowledgeEvents.some(
        (event) =>
          event.playerId === opponent.id && event.deckId === hiddenDeck.id,
      ),
    ).toBe(true);
  });
});
