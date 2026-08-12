import {
  cardId,
  deckId,
  expansionId,
  factionId,
  playerId,
  printingId,
  printRunId,
  productId,
  type PublisherCommand,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE_CONFIG } from "./day-context";
import { createPublisherTestWorld } from "./publisher-test-world";
import { simulateDay } from "./simulate-day";

describe("Phase 3B completion remediation", () => {
  it("fulfills a reprint commitment only after later-edition production completes", () => {
    const world = createPublisherTestWorld("reprint-commitment-edition");
    const targetProductId = productId("product-reprint-commitment");
    world.products[targetProductId] = {
      id: targetProductId,
      expansionId: expansionId("set-launch"),
      name: "Reprint Commitment Booster",
      kind: "BOOSTER",
      msrp: 5,
      cardIds: [Object.values(world.cards)[0]!.id],
      releaseStatus: "UNANNOUNCED",
      internalReleaseDay: 1,
    };
    let state = simulateDay(
      world,
      [
        {
          type: "PUBLISH_ANNOUNCEMENT",
          topic: "REPRINT",
          text: "We will complete a real reprint.",
          subjectId: targetProductId,
          commitment: {
            type: "COMPLETE_REPRINT",
            subjectId: targetProductId,
            dueDay: 40,
          },
        },
        {
          type: "ORDER_PRINT_RUN",
          productId: targetProductId,
          quantity: 100,
        },
      ],
      DEFAULT_BALANCE_CONFIG,
    ).nextState;
    while (
      !Object.values(state.printRuns).some(
        (run) =>
          run.productId === targetProductId && run.status === "COMPLETED",
      )
    ) {
      state = simulateDay(state, [], DEFAULT_BALANCE_CONFIG).nextState;
    }
    expect(state.announcementState?.announcements[0]?.commitment?.status).toBe(
      "PENDING",
    );

    state = simulateDay(
      state,
      [
        {
          type: "ORDER_PRINT_RUN",
          productId: targetProductId,
          quantity: 100,
        },
      ],
      DEFAULT_BALANCE_CONFIG,
    ).nextState;
    while (
      !Object.values(state.printRuns).some(
        (run) =>
          run.productId === targetProductId && run.edition === "UNLIMITED",
      )
    ) {
      state = simulateDay(state, [], DEFAULT_BALANCE_CONFIG).nextState;
    }

    expect(state.announcementState?.announcements[0]?.commitment?.status).toBe(
      "FULFILLED",
    );
    expect(
      state.history.events.filter(
        (event) => event.type === "COMMITMENT_FULFILLED",
      ),
    ).toHaveLength(1);
  });

  it("persists announcements and evaluates a fulfilled structured commitment", () => {
    const world = createPublisherTestWorld("announcement-commitment");
    const expansion = expansionId("set-commitment");
    const cards = Object.values(world.cards);
    cards[20]!.rarity = "RARE";
    cards[21]!.rarity = "RARE";
    cards[22]!.rarity = "LEGENDARY";
    cards[23]!.rarity = "LEGENDARY";
    const commands: PublisherCommand[] = [
      {
        type: "CREATE_EXPANSION",
        expansionId: expansion,
        name: "Commitment Set",
        size: 24,
        brief: {
          theme: "Commitment",
          focusFactionIds: [factionId("ember")],
          strategicDirections: [],
          productPositioning: "booster",
        },
      },
      ...cards.map((card, index): PublisherCommand => {
        const draft = {
          ...structuredClone(card),
          id: cardId(`card-commitment-${index + 1}`),
        };
        return {
          type: "UPDATE_CARD_DRAFT",
          expansionId: expansion,
          cardId: draft.id,
          draft,
        };
      }),
      {
        type: "PUBLISH_ANNOUNCEMENT",
        topic: "EXPANSION",
        text: "We will finalize this set today.",
        subjectId: expansion,
        commitment: {
          type: "FINALIZE_EXPANSION",
          subjectId: expansion,
          dueDay: world.day,
        },
      },
      { type: "FINALIZE_EXPANSION", expansionId: expansion },
    ];

    const result = simulateDay(world, commands, DEFAULT_BALANCE_CONFIG);
    expect(
      result.nextState.announcementState?.announcements[0]?.commitment?.status,
    ).toBe("FULFILLED");
    expect(result.notableEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "COMMITMENT_FULFILLED" }),
      ]),
    );
  });

  it("excludes a banned secondary deck from normal match sampling", () => {
    const world = createPublisherTestWorld("policy-match-legality");
    const cards = Object.values(world.cards);
    const factionCards = cards.filter(
      (card) => card.factionId === cards[0]!.factionId,
    );
    const bannedCard = factionCards[0]!;
    const legalCards = factionCards.slice(1, 11);
    const bannedDeckId = deckId("deck-banned");
    const legalDeckId = deckId("deck-legal");
    const secondDeckId = deckId("deck-opponent");
    const playerA = playerId("player-policy-a");
    const playerB = playerId("player-policy-b");
    const policyProduct = productId("product-policy-fixture");
    const printingIds = factionCards.map((card) =>
      printingId(`printing-${card.id}`),
    );
    world.products[policyProduct] = {
      id: policyProduct,
      expansionId: expansionId("set-launch"),
      name: "Policy Fixture Booster",
      kind: "BOOSTER",
      msrp: 5,
      cardIds: factionCards.map((card) => card.id),
      releaseStatus: "LIVE",
      internalReleaseDay: 1,
      announcedReleaseDay: 1,
      releasedDay: 1,
    };
    factionCards.forEach((card, index) => {
      world.printings[printingIds[index]!] = {
        id: printingIds[index]!,
        cardId: card.id,
        expansionId: expansionId("set-launch"),
        edition: "FIRST_EDITION",
        sourceProductId: policyProduct,
        sourceExpansionId: expansionId("set-launch"),
      };
    });
    const runId = printRunId("print-run-policy-fixture");
    world.printRuns[runId] = {
      id: runId,
      productId: policyProduct,
      sourceExpansionId: expansionId("set-launch"),
      productKind: "BOOSTER",
      cardIds: factionCards.map((card) => card.id),
      orderedQuantity: 100,
      quantity: 0,
      orderedDay: 0,
      completionDay: 0,
      unitCost: 1,
      totalCost: 100,
      status: "COMPLETED",
      edition: "FIRST_EDITION",
      printingIds,
    };
    world.decks[bannedDeckId] = {
      id: bannedDeckId,
      factionId: bannedCard.factionId,
      cards: factionCards
        .slice(0, 10)
        .map((card) => ({ cardId: card.id, count: 2 as const })),
      strategy: {},
      originPlayerId: playerA,
      parentDeckIds: [],
      generation: 0,
      createdDay: 1,
    };
    for (const [id, owner] of [
      [legalDeckId, playerA],
      [secondDeckId, playerB],
    ] as const) {
      world.decks[id] = {
        id,
        factionId: legalCards[0]!.factionId,
        cards: legalCards.map((card) => ({
          cardId: card.id,
          count: 2 as const,
        })),
        strategy: {},
        originPlayerId: owner,
        parentDeckIds: [],
        generation: 0,
        createdDay: 1,
      };
      world.players[owner] = {
        id: owner,
        activity: "ACTIVE",
        tenureDays: 1,
        skill: 0.5,
        motivation: {
          competitive: 1,
          collector: 0,
          brewer: 0,
          casual: 0,
          budgetSensitivity: 0,
          whale: 0,
        },
        loyalty: 0.5,
        tcgWallet: 100,
        collection: Object.fromEntries(printingIds.map((id) => [id, 2])),
        deckIds:
          owner === playerA ? [bannedDeckId, legalDeckId] : [secondDeckId],
        knowledge: { knownCardIds: [], knownDeckIds: [] },
        satisfaction: 0.5,
      };
    }
    const scheduled = simulateDay(
      world,
      [{ type: "SCHEDULE_BAN", cardId: bannedCard.id, timing: "EMERGENCY" }],
      DEFAULT_BALANCE_CONFIG,
    ).nextState;
    const activated = simulateDay(scheduled, [], DEFAULT_BALANCE_CONFIG);
    expect(Object.keys(activated.nextState.meta.deckStats)).not.toContain(
      bannedDeckId,
    );
  });
});
