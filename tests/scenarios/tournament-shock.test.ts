import {
  cardId,
  deckId,
  factionId,
  playerId,
  printingId,
  productId,
  tournamentId,
  type CardDefinition,
  type DeckGenome,
  type PersistentPlayer,
  type WorldState,
} from "../../packages/domain/src/index";
import {
  calculateAdoptionScore,
  openStarter,
  registerTournamentEntrants,
  simulateTournament,
  type BanlistVersion,
} from "../../packages/sim-core/src/index";
import { createTestWorld } from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

const coldDeckId = deckId("deck-tournament-shock-cold");

function cardsFor(
  prefix: string,
  attack: number,
  health: number,
  cost: number,
): CardDefinition[] {
  return Array.from({ length: 10 }, (_, index) => ({
    id: cardId(`card-tournament-${prefix}-${index}`),
    name: `${prefix} ${index}`,
    type: "UNIT" as const,
    factionId: factionId("fire"),
    rarity: "COMMON" as const,
    cost,
    attack,
    health,
    keywords: [],
    triggers: [],
  }));
}

function createPlayer(
  template: PersistentPlayer,
  id: string,
  skill: number,
): PersistentPlayer {
  return {
    ...structuredClone(template),
    id: playerId(id),
    skill,
    activity: "ACTIVE",
    tcgWallet: 500,
    collection: {},
    deckIds: [],
    knowledge: { knownCardIds: [], knownDeckIds: [] },
  };
}

function createDeck(
  id: ReturnType<typeof deckId>,
  owner: PersistentPlayer,
  cards: readonly CardDefinition[],
): DeckGenome {
  return {
    id,
    factionId: factionId("fire"),
    cards: cards.map((card) => ({ cardId: card.id, count: 2 })),
    strategy: {
      aggression: 1,
      value: 0.5,
      preservation: 0.2,
      competitive: 1,
    },
    originPlayerId: owner.id,
    parentDeckIds: [],
    generation: 0,
    createdDay: 0,
  };
}

function addStarter(
  world: WorldState,
  key: string,
  cards: readonly CardDefinition[],
): ReturnType<typeof printingId>[] {
  const sourceProductId = productId(`product-tournament-${key}`);
  world.products[sourceProductId] = {
    id: sourceProductId,
    expansionId: world.expansions["set-launch"]!.id,
    name: `${key} Starter`,
    kind: "STARTER",
    msrp: 15,
    cardIds: cards.map((card) => card.id),
    releaseStatus: "LIVE",
    internalReleaseDay: 0,
    releasedDay: 0,
  };
  const ids = cards.map((card) => printingId(`printing-tournament-${card.id}`));
  for (const [index, card] of cards.entries()) {
    const id = ids[index]!;
    world.printings[id] = {
      id,
      cardId: card.id,
      expansionId: world.expansions["set-launch"]!.id,
      edition: "FIRST_EDITION",
      sourceProductId,
      sourceExpansionId: world.expansions["set-launch"]!.id,
    };
  }
  return ids.flatMap((id) => [id, id]);
}

function createTournamentShockWorld(): {
  world: WorldState;
  coldDeck: DeckGenome;
  audience: PersistentPlayer;
} {
  const world = createTestWorld("tournament-shock");
  world.status = "LIVE";
  world.day = 10;
  world.cards = {};
  world.printings = {};
  world.products = {};
  world.decks = {};
  world.agents = {};
  const template = Object.values(world.players)[0]!;
  const brewer = createPlayer(template, "player-tournament-brewer", 0.1);
  const audience = createPlayer(template, "player-tournament-audience", 0.9);
  audience.motivation.competitive = 1;
  world.players = { [brewer.id]: brewer, [audience.id]: audience };

  const coldCards = cardsFor("cold", 8, 8, 1);
  const establishedCards = cardsFor("established", 0, 1, 8);
  world.cards = Object.fromEntries(
    [...coldCards, ...establishedCards].map((card) => [card.id, card]),
  );
  const coldDeck = createDeck(coldDeckId, brewer, coldCards);
  const establishedDeck = createDeck(
    deckId("deck-tournament-established"),
    audience,
    establishedCards,
  );
  world.decks = {
    [coldDeck.id]: coldDeck,
    [establishedDeck.id]: establishedDeck,
  };

  brewer.deckIds = [coldDeck.id];
  brewer.knowledge = {
    knownCardIds: coldCards.map((card) => card.id),
    knownDeckIds: [coldDeck.id],
  };
  audience.deckIds = [establishedDeck.id];
  audience.knowledge = {
    knownCardIds: establishedCards.map((card) => card.id),
    knownDeckIds: [establishedDeck.id],
  };
  openStarter(
    world,
    productId("product-tournament-cold"),
    brewer.id,
    addStarter(world, "cold", coldCards),
  );
  openStarter(
    world,
    productId("product-tournament-established"),
    audience.id,
    addStarter(world, "established", establishedCards),
  );
  return { world, coldDeck, audience };
}

function adoptionIntent(
  player: PersistentPlayer,
  deck: DeckGenome,
  tournamentPrestige: number,
): number {
  return calculateAdoptionScore(player, deck, {
    performance: 0.8,
    socialExposure: player.knowledge.knownDeckIds.includes(deck.id) ? 1 : 0,
    tournamentPrestige,
    influencerExposure: 0,
    novelty: 0.8,
    deckPrice: 0,
    missingCardCount: 20,
    complexity: 0,
  });
}

describe("tournament shock", () => {
  it("turns a cold Major winner into public knowledge and higher later adoption intent", () => {
    const { world, coldDeck, audience } = createTournamentShockWorld();
    const banlist: BanlistVersion = Object.freeze({
      id: "banlist-tournament-shock",
      effectiveDay: 0,
      bannedCardIds: Object.freeze([]),
      restrictedCardIds: Object.freeze([]),
    });
    const knownBefore = Object.values(world.players).filter((player) =>
      player.knowledge.knownDeckIds.includes(coldDeck.id),
    ).length;
    const adoptionBefore = adoptionIntent(audience, coldDeck, 0);
    const registration = registerTournamentEntrants(
      world,
      {
        id: tournamentId("tournament-shock-major"),
        name: "Shock Major",
        preset: "MAJOR",
        createdDay: 0,
        eventDay: 10,
      },
      banlist,
    );

    const result = simulateTournament(world, registration);
    const winnerAttention = result.attentionEvents.find(
      (event) => event.deckId === coldDeck.id && event.placement === 1,
    );
    const adoptionAfter = adoptionIntent(
      audience,
      coldDeck,
      winnerAttention?.tournamentPrestige ?? 0,
    );
    const knownAfter = Object.values(world.players).filter((player) =>
      player.knowledge.knownDeckIds.includes(coldDeck.id),
    ).length;

    expect(knownBefore).toBe(1);
    expect(result.winner.deckId).toBe(coldDeck.id);
    expect(result.publicKnowledgeEvents).toContainEqual(
      expect.objectContaining({
        type: "TOURNAMENT_DECKLIST_PUBLIC",
        deckId: coldDeck.id,
      }),
    );
    expect(winnerAttention).toMatchObject({
      type: "TOURNAMENT_ATTENTION",
      preset: "MAJOR",
      placement: 1,
    });
    expect(knownAfter).toBe(2);
    expect(adoptionAfter).toBeGreaterThan(adoptionBefore);
    expect(world.meta.deckStats[coldDeck.id]).toBeUndefined();
  });
});
