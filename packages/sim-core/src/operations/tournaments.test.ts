import { TOURNAMENT_CONFIG } from "@tcgtycoon/balance";
import {
  cardId,
  deckId,
  expansionId,
  factionId,
  playerId,
  printingId,
  productId,
  tournamentId,
  type CardDefinition,
  type DeckGenome,
  type PersistentPlayer,
  type TournamentSchedule,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { createInitialWorldMetrics } from "../metrics/world-metrics";
import { openStarter } from "../products/open-product";
import type { BanlistVersion } from "./policies";
import { registerTournamentEntrants, simulateTournament } from "./tournaments";

const EMPTY_BANLIST: BanlistVersion = Object.freeze({
  id: "banlist-test-empty",
  effectiveDay: 0,
  bannedCardIds: Object.freeze([]),
  restrictedCardIds: Object.freeze([]),
});

type TournamentFixture = {
  world: WorldState;
  coldDeck: DeckGenome;
  weakDecks: DeckGenome[];
  coldPlayer: PersistentPlayer;
};

function createUnits(
  prefix: string,
  attack: number,
  health: number,
  cost: number,
): CardDefinition[] {
  return Array.from({ length: 10 }, (_, index) => ({
    id: cardId(`card-${prefix}-${index}`),
    name: `${prefix} unit ${index}`,
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

function createPlayer(id: string, skill: number): PersistentPlayer {
  return {
    id: playerId(id),
    motivation: {
      competitive: 0.8,
      brewer: 0.2,
      casual: 0.2,
      collector: 0,
      budgetSensitivity: 0.2,
      whale: 0,
    },
    skill,
    loyalty: 0.5,
    tenureDays: 20,
    tcgWallet: 100,
    activity: "ACTIVE",
    collection: {},
    deckIds: [],
    knowledge: { knownCardIds: [], knownDeckIds: [] },
    satisfaction: 0.5,
  };
}

function addStarter(
  world: WorldState,
  id: string,
  cards: readonly CardDefinition[],
): ReturnType<typeof printingId>[] {
  const sourceProductId = productId(`product-${id}`);
  world.products[sourceProductId] = {
    id: sourceProductId,
    expansionId: expansionId("set-launch"),
    name: `${id} Starter`,
    kind: "STARTER",
    msrp: 15,
    cardIds: cards.map((card) => card.id),
    releaseStatus: "LIVE",
    internalReleaseDay: 0,
    releasedDay: 0,
  };
  const printingIds = cards.map((card) => printingId(`printing-${card.id}`));
  for (const [index, card] of cards.entries()) {
    const id = printingIds[index]!;
    world.printings[id] = {
      id,
      cardId: card.id,
      expansionId: expansionId("set-launch"),
      edition: "FIRST_EDITION",
      sourceProductId,
      sourceExpansionId: expansionId("set-launch"),
    };
  }
  return printingIds.flatMap((id) => [id, id]);
}

function deckFor(
  id: string,
  owner: PersistentPlayer,
  cards: readonly CardDefinition[],
): DeckGenome {
  return {
    id: deckId(id),
    factionId: cards[0]!.factionId,
    cards: cards.map((card) => ({ cardId: card.id, count: 2 })),
    strategy: { aggression: 1, value: 0.5, preservation: 0.2 },
    originPlayerId: owner.id,
    parentDeckIds: [],
    generation: 0,
    createdDay: 0,
  };
}

function createTournamentFixture(seed: string): TournamentFixture {
  const coldPlayer = createPlayer("player-cold", 0.1);
  const weakPlayers = Array.from({ length: 3 }, (_, index) =>
    createPlayer(`player-weak-${index}`, 0.9),
  );
  const world: WorldState = {
    schemaVersion: 5,
    simulationVersion: "1",
    ruleVersion: "1",
    balanceVersion: "1",
    worldSeed: seed,
    day: 20,
    status: "LIVE",
    cards: {},
    printings: {},
    expansions: {
      "set-launch": {
        id: expansionId("set-launch"),
        name: "Launch Set",
      },
    },
    products: {},
    printRuns: {},
    players: Object.fromEntries(
      [coldPlayer, ...weakPlayers].map((player) => [player.id, player]),
    ),
    agents: {},
    decks: {},
    cohorts: [],
    market: { listings: [], snapshots: {} },
    meta: { deckStats: {}, matchups: {} },
    metrics: createInitialWorldMetrics({
      potential: 0,
      interested: 0,
      newByAge: [0, 0, 0, 0, 0, 0, 0],
      active: 4,
      atRisk: 0,
      churned: 0,
      returning: 0,
    }),
    cash: { balance: 0, ledger: [] },
    history: { events: [] },
  };

  const coldCards = createUnits("cold", 8, 8, 1);
  const weakCards = createUnits("weak", 0, 1, 8);
  world.cards = Object.fromEntries(
    [...coldCards, ...weakCards].map((card) => [card.id, card]),
  );
  const coldStarter = addStarter(world, "cold", coldCards);
  const weakStarter = addStarter(world, "weak", weakCards);
  const coldDeck = deckFor("deck-cold", coldPlayer, coldCards);
  const weakDecks = weakPlayers.map((player, index) =>
    deckFor(`deck-weak-${index}`, player, weakCards),
  );
  world.decks = Object.fromEntries(
    [coldDeck, ...weakDecks].map((deck) => [deck.id, deck]),
  );

  coldPlayer.deckIds = [coldDeck.id];
  coldPlayer.knowledge = {
    knownCardIds: coldCards.map((card) => card.id),
    knownDeckIds: [coldDeck.id],
  };
  openStarter(world, productId("product-cold"), coldPlayer.id, coldStarter);
  for (const [index, player] of weakPlayers.entries()) {
    const deck = weakDecks[index]!;
    player.deckIds = [deck.id];
    player.knowledge = {
      knownCardIds: weakCards.map((card) => card.id),
      knownDeckIds: [deck.id],
    };
    openStarter(world, productId("product-weak"), player.id, weakStarter);
  }

  return { world, coldDeck, weakDecks, coldPlayer };
}

function schedule(preset: TournamentSchedule["preset"]): TournamentSchedule {
  return {
    id: tournamentId(`tournament-${preset.toLowerCase()}`),
    name: `${preset} Championship`,
    preset,
    createdDay: 10,
    eventDay: 20,
  };
}

describe("official tournaments", () => {
  it("defines the approved player caps and preparation times", () => {
    expect(TOURNAMENT_CONFIG).toEqual({
      LOCAL: { maxPlayers: 32, prepDays: 2 },
      REGIONAL: { maxPlayers: 128, prepDays: 5 },
      MAJOR: { maxPlayers: 512, prepDays: 10 },
    });
  });

  it("registers only players with an owned deck legal under the active banlist", () => {
    const { world, coldDeck, weakDecks } = createTournamentFixture(
      "tournament-registration",
    );
    const unownedPlayer = createPlayer("player-unowned", 0.5);
    unownedPlayer.deckIds = [weakDecks[0]!.id];
    world.players[unownedPlayer.id] = unownedPlayer;
    const banlist: BanlistVersion = Object.freeze({
      id: "banlist-test-active",
      effectiveDay: 15,
      bannedCardIds: Object.freeze([weakDecks[0]!.cards[0]!.cardId]),
      restrictedCardIds: Object.freeze([]),
    });

    const registration = registerTournamentEntrants(
      world,
      schedule("MAJOR"),
      banlist,
    );

    expect(registration.banlistVersionId).toBe(banlist.id);
    expect(registration.ruleVersion).toBe(world.ruleVersion);
    expect(registration.entrants.map((entrant) => entrant.playerId)).toEqual([
      coldDeck.originPlayerId,
    ]);
    expect(
      registration.entrants.some(
        (entrant) => entrant.playerId === unownedPlayer.id,
      ),
    ).toBe(false);
  });

  it("uses stable seeded pairings and preserves final and notable-upset replays", () => {
    const firstFixture = createTournamentFixture("tournament-bracket");
    const registration = registerTournamentEntrants(
      firstFixture.world,
      schedule("MAJOR"),
      EMPTY_BANLIST,
    );
    const first = simulateTournament(firstFixture.world, registration);
    const secondFixture = createTournamentFixture("tournament-bracket");
    const second = simulateTournament(secondFixture.world, registration);

    expect(second).toEqual(first);
    expect(first.matches).toHaveLength(3);
    expect(first.top8).toHaveLength(4);
    expect(first.top8[0]?.playerId).toBe(first.winner.playerId);
    expect(first.winner.deckId).toBe(firstFixture.coldDeck.id);
    expect(first.matches.find((match) => match.isFinal)?.replay).toBeDefined();
    expect(
      first.matches.find((match) => !match.isFinal && match.isNotableUpset)
        ?.replay?.actionLog.length,
    ).toBeGreaterThan(0);
    expect(
      first.matches.find((match) => !match.isFinal && !match.isNotableUpset)
        ?.replay,
    ).toBeUndefined();
    expect(
      first.matches.every(
        (match) =>
          match.banlistVersionId === EMPTY_BANLIST.id &&
          match.ruleVersion === firstFixture.world.ruleVersion,
      ),
    ).toBe(true);
  });
});
