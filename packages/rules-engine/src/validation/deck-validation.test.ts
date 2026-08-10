import {
  cardId,
  deckId,
  factionId,
  type CardDefinition,
  type DeckDefinition,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { validateDeck } from "./deck-validation";

const fireFactionId = factionId("fire");
const machineFactionId = factionId("machine");
const neutralFactionId = factionId("neutral");

const makeUnit = (
  id: string,
  cardFactionId = fireFactionId,
): CardDefinition => ({
  id: cardId(id),
  name: id,
  type: "UNIT",
  factionId: cardFactionId,
  rarity: "COMMON",
  cost: 1,
  attack: 1,
  health: 1,
  keywords: [],
  triggers: [],
});

const fireCards = Array.from({ length: 10 }, (_, index) =>
  makeUnit(`card-fire-${index + 1}`),
);
const neutralCard = makeUnit("card-neutral-scout", neutralFactionId);
const machineCard = makeUnit("card-machine-guard", machineFactionId);
const cardPool = [...fireCards, neutralCard, machineCard];

const legalDeck: DeckDefinition = {
  id: deckId("deck-fire-fixture"),
  name: "Fire Fixture",
  factionId: fireFactionId,
  cards: [
    ...fireCards
      .slice(0, 9)
      .map((card) => ({ cardId: card.id, count: 2 as const })),
    { cardId: neutralCard.id, count: 2 },
  ],
};

describe("validateDeck", () => {
  it("accepts exactly 20 cards from one faction plus neutral", () => {
    expect(validateDeck(legalDeck, cardPool)).toEqual({
      valid: true,
      issues: [],
    });
  });

  it("rejects 19-card decks", () => {
    const deck: DeckDefinition = {
      ...legalDeck,
      cards: [
        ...fireCards
          .slice(0, 9)
          .map((card) => ({ cardId: card.id, count: 2 as const })),
        { cardId: neutralCard.id, count: 1 },
      ],
    };

    expect(validateDeck(deck, cardPool)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "DECK_SIZE" }),
      ]),
    });
  });

  it("rejects three copies of a normal card", () => {
    const deck: DeckDefinition = {
      ...legalDeck,
      cards: [
        ...legalDeck.cards,
        { cardId: legalDeck.cards[0]!.cardId, count: 1 },
      ],
    };

    expect(validateDeck(deck, cardPool)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "COPY_LIMIT" }),
      ]),
    });
  });

  it("rejects cards from a second non-neutral faction", () => {
    const deck: DeckDefinition = {
      ...legalDeck,
      cards: [
        ...legalDeck.cards.slice(0, -1),
        { cardId: machineCard.id, count: 2 },
      ],
    };

    expect(validateDeck(deck, cardPool)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "FACTION_MISMATCH",
          entityId: machineCard.id,
        }),
      ]),
    });
  });

  it("rejects references to cards outside the supplied card pool", () => {
    const missingCardId = cardId("card-missing");
    const deck: DeckDefinition = {
      ...legalDeck,
      cards: [
        ...legalDeck.cards.slice(0, -1),
        { cardId: missingCardId, count: 2 },
      ],
    };

    expect(validateDeck(deck, cardPool)).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "CARD_NOT_FOUND",
          entityId: missingCardId,
        }),
      ]),
    });
  });
});
