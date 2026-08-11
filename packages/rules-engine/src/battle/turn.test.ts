import { RULES_CONFIG } from "@tcgtycoon/balance";
import {
  cardId,
  deckId,
  factionId,
  type CardDefinition,
  type DeckDefinition,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { enumerateLegalActions } from "../ai/battle-ai";
import {
  enqueueTriggers,
  resolveTriggerQueue,
  type ResolutionContext,
} from "./triggers";
import {
  COIN_CARD_ID,
  createMatchState,
  mulliganCards,
} from "./create-match-state";
import { drawCard, endTurn, startTurn } from "./turn";

const fireFactionId = factionId("fire");
const cardDefinitions: CardDefinition[] = Array.from(
  { length: 10 },
  (_, index) => ({
    id: cardId(`card-fire-${index + 1}`),
    name: `Fire ${index + 1}`,
    type: "UNIT",
    factionId: fireFactionId,
    rarity: "COMMON",
    cost: 1,
    attack: 1,
    health: 1,
    keywords: [],
    triggers: [],
  }),
);
const fixtureDeck: DeckDefinition = {
  id: deckId("deck-fire-fixture"),
  name: "Fire Fixture",
  factionId: fireFactionId,
  cards: cardDefinitions.map((card) => ({ cardId: card.id, count: 2 })),
};
const cards = new Map(cardDefinitions.map((card) => [card.id, card]));

function createFixtureState(seed = 12345n) {
  return createMatchState({
    seed,
    deckA: fixtureDeck,
    deckB: fixtureDeck,
    cards,
  });
}

describe("match setup and turns", () => {
  it("deals 3 cards to first player and 4 plus Coin to second player", () => {
    const state = createFixtureState();
    const repeatedState = createFixtureState();

    expect(state.players.A.hand).toHaveLength(3);
    expect(state.players.A.deck).toHaveLength(17);
    expect(state.players.B.hand).toHaveLength(5);
    expect(state.players.B.deck).toHaveLength(16);
    expect(
      state.players.B.hand.filter((card) => card.cardId === COIN_CARD_ID),
    ).toHaveLength(1);
    expect(state.players.A.hand.map((card) => card.cardId)).toEqual(
      repeatedState.players.A.hand.map((card) => card.cardId),
    );
    expect(state.players.B.hand.map((card) => card.cardId)).toEqual(
      repeatedState.players.B.hand.map((card) => card.cardId),
    );
  });

  it("increases and refills permanent mana up to 8", () => {
    const state = createFixtureState(23456n);
    state.players.A.maxMana = RULES_CONFIG.maxMana - 1;
    state.players.A.mana = 0;

    startTurn(state);

    expect(state.players.A.maxMana).toBe(RULES_CONFIG.maxMana);
    expect(state.players.A.mana).toBe(RULES_CONFIG.maxMana);

    state.players.A.mana = 0;
    startTurn(state);

    expect(state.players.A.maxMana).toBe(RULES_CONFIG.maxMana);
    expect(state.players.A.mana).toBe(RULES_CONFIG.maxMana);
  });

  it("deals 1 then 2 fatigue damage when drawing from an empty deck", () => {
    const state = createFixtureState(34567n);
    state.players.A.deck = [];

    const firstDraw = drawCard(state, "A");
    const secondDraw = drawCard(state, "A");

    expect(firstDraw).toEqual({ type: "FATIGUE", damage: 1 });
    expect(secondDraw).toEqual({ type: "FATIGUE", damage: 2 });
    expect(state.players.A.heroHealth).toBe(RULES_CONFIG.heroHealth - 3);
    expect(state.players.A.fatigue).toBe(2);
  });

  it("burns a drawn card when hand already contains 10 cards", () => {
    const state = createFixtureState(45678n);
    const player = state.players.A;
    const expectedBurnedCardId = player.deck.at(-1)!;

    while (player.hand.length < RULES_CONFIG.handLimit) {
      player.hand.push({
        instanceId: `test-hand-${player.hand.length}`,
        cardId: cardId("card-neutral-scout"),
      });
    }

    const result = drawCard(state, "A");

    expect(result).toMatchObject({
      type: "BURNED",
      card: { cardId: expectedBurnedCardId },
    });
    expect(player.hand).toHaveLength(RULES_CONFIG.handLimit);
    expect(player.deck).toHaveLength(16);
    expect(player.discard.at(-1)).toMatchObject({
      cardId: expectedBurnedCardId,
    });
    expect(state.actionLog.at(-1)).toMatchObject({
      type: "CARD_BURNED",
      side: "A",
      cardId: expectedBurnedCardId,
    });
  });

  it("does not redraw returned cards until mulligan replacements are complete", () => {
    const state = createFixtureState(56789n);
    const returned = state.players.A.hand[0]!;
    const replacementCardId = cardId("card-fire-phoenix");
    state.players.A.hand = [returned];
    state.players.A.deck = [replacementCardId];

    mulliganCards(state, "A", [returned.instanceId]);

    expect(state.players.A.hand).toHaveLength(1);
    expect(state.players.A.hand[0]).toMatchObject({
      cardId: replacementCardId,
    });
    expect(state.players.A.deck).toEqual([returned.cardId]);
  });

  it("passes the active side when the turn ends", () => {
    const state = createFixtureState(67890n);

    endTurn(state);

    expect(state.activeSide).toBe("B");
  });

  it("keeps a start-of-turn summon unable to attack immediately", () => {
    const token: CardDefinition = {
      id: cardId("card-start-token"),
      name: "Start Token",
      type: "UNIT",
      factionId: fireFactionId,
      rarity: "COMMON",
      cost: 1,
      attack: 1,
      health: 1,
      keywords: [],
      triggers: [],
    };
    const summoner: CardDefinition = {
      id: cardId("card-start-summoner"),
      name: "Start Summoner",
      type: "UNIT",
      factionId: fireFactionId,
      rarity: "COMMON",
      cost: 2,
      attack: 1,
      health: 2,
      keywords: [],
      triggers: [
        {
          trigger: "TURN_START",
          conditions: [],
          effects: [{ type: "SUMMON", tokenCardId: token.id, amount: 1 }],
        },
      ],
    };
    const state = createFixtureState(78901n);
    state.turnNumber = 1;
    state.players.A.board = [
      {
        instanceId: "start-summoner-instance",
        cardId: summoner.id,
        attack: summoner.attack,
        health: summoner.health,
        maxHealth: summoner.health,
        keywords: [],
        summonedTurn: 0,
        attacksThisTurn: 0,
        lastAttackTurn: 0,
      },
    ];
    const definitions = new Map(
      [...cardDefinitions, summoner, token].map((card) => [card.id, card]),
    );
    const ctx: ResolutionContext = {
      state,
      cardDefinitions: definitions,
      queue: [],
      actionCount: 0,
      triggerDepth: 0,
      summonsThisChain: 0,
      warnings: [],
      source: {
        side: "A",
        instanceId: "hero:A",
        cardId: COIN_CARD_ID,
      },
    };

    startTurn(state, () => {
      enqueueTriggers(ctx, { type: "TURN_START", side: "A" });
      resolveTriggerQueue(ctx);
    });

    const summoned = state.players.A.board.find(
      (unit) => unit.cardId === token.id,
    );
    expect(summoned).toBeDefined();
    expect(summoned?.summonedTurn).toBe(state.turnNumber);
    expect(
      enumerateLegalActions(state, definitions).some(
        (action) =>
          action.type === "ATTACK" &&
          action.attackerId === summoned?.instanceId,
      ),
    ).toBe(false);
  });

  it("rejects invalid Card DSL before creating match state", () => {
    const invalidCard = {
      ...cardDefinitions[0]!,
      cost: -1,
    } as CardDefinition;
    const invalidCards = new Map(
      cardDefinitions.map((card) => [
        card.id,
        card.id === invalidCard.id ? invalidCard : card,
      ]),
    );

    expect(() =>
      createMatchState({
        seed: 89012n,
        deckA: fixtureDeck,
        deckB: fixtureDeck,
        cards: invalidCards,
      }),
    ).toThrow(/invalid card definition/i);
  });

  it("rejects missing Card DSL references before creating match state", () => {
    const invalidCard: CardDefinition = {
      ...cardDefinitions[0]!,
      triggers: [
        {
          trigger: "ON_PLAY",
          conditions: [],
          effects: [
            {
              type: "SUMMON",
              tokenCardId: cardId("card-missing-token"),
              amount: 1,
            },
          ],
        },
      ],
    };
    const invalidCards = new Map(
      cardDefinitions.map((card) => [
        card.id,
        card.id === invalidCard.id ? invalidCard : card,
      ]),
    );

    expect(() =>
      createMatchState({
        seed: 90123n,
        deckA: fixtureDeck,
        deckB: fixtureDeck,
        cards: invalidCards,
      }),
    ).toThrow(/missing card definition/i);
  });
});
