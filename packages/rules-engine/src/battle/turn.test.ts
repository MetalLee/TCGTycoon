import { RULES_CONFIG } from "@tcgtycoon/balance";
import {
  cardId,
  deckId,
  factionId,
  type CardDefinition,
  type DeckDefinition,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
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
});
