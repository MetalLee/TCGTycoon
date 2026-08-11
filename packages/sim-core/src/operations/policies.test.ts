import {
  cardId,
  deckId,
  expansionId,
  factionId,
  operationId,
  printingId,
  productId,
  type CardDefinition,
  type DeckDefinition,
  type WorldState,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import {
  activatePolicyChanges,
  applyStandardRotation,
  createPolicyState,
  getActiveBanlist,
  schedulePolicyChange,
  validateDeckForBanlist,
} from "./policies";

function createCards(): CardDefinition[] {
  return Array.from({ length: 10 }, (_, index) => ({
    id: cardId(`card-policy-${index}`),
    name: `Policy Unit ${index}`,
    type: "UNIT" as const,
    factionId: factionId("fire"),
    rarity: "COMMON" as const,
    cost: 2,
    attack: 2,
    health: 2,
    keywords: [],
    triggers: [],
  }));
}

function createDeck(cards: readonly CardDefinition[]): DeckDefinition {
  return {
    id: deckId("deck-policy"),
    name: "Policy Deck",
    factionId: factionId("fire"),
    cards: cards.map((card) => ({ cardId: card.id, count: 2 })),
  };
}

describe("versioned Standard policy", () => {
  it("scheduled restriction becomes active after three days by default", () => {
    const state = createPolicyState();
    schedulePolicyChange(state, {
      id: operationId("policy-scheduled-restriction"),
      kind: "RESTRICTION",
      cardId: cardId("card-policy-0"),
      createdDay: 10,
      timing: "SCHEDULED",
    });

    activatePolicyChanges(state, 12);
    expect(getActiveBanlist(state, 12).restrictedCardIds).toEqual([]);

    const activated = activatePolicyChanges(state, 13);
    expect(activated).toHaveLength(1);
    expect(getActiveBanlist(state, 13)).toMatchObject({
      effectiveDay: 13,
      restrictedCardIds: [cardId("card-policy-0")],
    });
  });

  it("emergency restriction becomes active next live day", () => {
    const state = createPolicyState();
    schedulePolicyChange(state, {
      id: operationId("policy-emergency-restriction"),
      kind: "RESTRICTION",
      cardId: cardId("card-policy-0"),
      createdDay: 10,
      timing: "EMERGENCY",
    });

    activatePolicyChanges(state, 10);
    expect(getActiveBanlist(state, 10).restrictedCardIds).toEqual([]);

    activatePolicyChanges(state, 11);
    expect(getActiveBanlist(state, 11).restrictedCardIds).toEqual([
      cardId("card-policy-0"),
    ]);
  });

  it("restricted card copy limit becomes one", () => {
    const cards = createCards();
    const deck = createDeck(cards);
    const state = createPolicyState();
    schedulePolicyChange(state, {
      id: operationId("policy-copy-limit"),
      kind: "RESTRICTION",
      cardId: cards[0]!.id,
      createdDay: 1,
      timing: "EMERGENCY",
    });
    activatePolicyChanges(state, 2);

    const result = validateDeckForBanlist(
      deck,
      cards,
      getActiveBanlist(state, 2),
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "RESTRICTED_COPY_LIMIT",
        entityId: cards[0]!.id,
      }),
    );
  });

  it("banned card makes a deck illegal", () => {
    const cards = createCards();
    const deck = createDeck(cards);
    const state = createPolicyState();
    schedulePolicyChange(state, {
      id: operationId("policy-ban"),
      kind: "BAN",
      cardId: cards[0]!.id,
      createdDay: 1,
      timing: "EMERGENCY",
    });
    activatePolicyChanges(state, 2);

    const result = validateDeckForBanlist(
      deck,
      cards,
      getActiveBanlist(state, 2),
    );

    expect(result.valid).toBe(false);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "BANNED_CARD", entityId: cards[0]!.id }),
    );
  });

  it("sixth Standard set rotates the oldest set", () => {
    const releaseOrder = Array.from({ length: 6 }, (_, index) =>
      expansionId(`set-${index + 1}`),
    );
    const world = createRotationWorld(releaseOrder);

    const rotation = applyStandardRotation(world, releaseOrder);

    expect(rotation.activeExpansionIds).toEqual(releaseOrder.slice(1));
    expect(rotation.rotatedExpansionIds).toEqual([releaseOrder[0]]);
  });

  it("rotation does not delete physical cards or Printings", () => {
    const releaseOrder = Array.from({ length: 6 }, (_, index) =>
      expansionId(`set-${index + 1}`),
    );
    const world = createRotationWorld(releaseOrder);
    const beforeCards = structuredClone(world.cards);
    const beforePrintings = structuredClone(world.printings);

    applyStandardRotation(world, releaseOrder);

    expect(world.cards).toEqual(beforeCards);
    expect(world.printings).toEqual(beforePrintings);
  });
});

function createRotationWorld(
  releaseOrder: readonly ReturnType<typeof expansionId>[],
): Pick<WorldState, "cards" | "expansions" | "printings"> {
  const cards = releaseOrder.map((setId, index) => ({
    id: cardId(`card-${setId}`),
    name: `Card ${index + 1}`,
    type: "UNIT" as const,
    factionId: factionId("fire"),
    rarity: "COMMON" as const,
    cost: 1,
    attack: 1,
    health: 1,
    keywords: [],
    triggers: [],
  }));
  return {
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    expansions: Object.fromEntries(
      releaseOrder.map((id, index) => [id, { id, name: `Set ${index + 1}` }]),
    ),
    printings: Object.fromEntries(
      cards.map((card, index) => {
        const sourceExpansionId = releaseOrder[index]!;
        const id = printingId(`printing-${card.id}`);
        return [
          id,
          {
            id,
            cardId: card.id,
            expansionId: sourceExpansionId,
            edition: "FIRST_EDITION" as const,
            sourceProductId: productId(`product-${sourceExpansionId}`),
            sourceExpansionId,
          },
        ];
      }),
    ),
  };
}
