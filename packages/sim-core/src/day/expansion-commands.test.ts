import {
  expansionId,
  factionId,
  type PublisherCommand,
} from "@tcgtycoon/domain";
import { describe, expect, it } from "vitest";
import { DEFAULT_BALANCE_CONFIG } from "./day-context";
import { createPublisherTestWorld } from "./publisher-test-world";
import { simulateDay } from "./simulate-day";

describe("expansion publisher commands", () => {
  it("persists and completes a Playtest report through the day loop", () => {
    const world = createPublisherTestWorld("durable-playtest-report");
    const id = expansionId("set-durable-playtest");
    const worldCards = Object.values(world.cards);
    worldCards[20]!.rarity = "RARE";
    worldCards[21]!.rarity = "RARE";
    worldCards[22]!.rarity = "LEGENDARY";
    worldCards[23]!.rarity = "LEGENDARY";
    const drafts = worldCards.map((card, index) => ({
      ...structuredClone(card),
      id: `card-durable-playtest-${String(index + 1).padStart(2, "0")}` as typeof card.id,
    }));
    let next = simulateDay(
      world,
      [
        {
          type: "CREATE_EXPANSION",
          expansionId: id,
          name: "Durable Playtest",
          size: 24,
          brief: {
            theme: "Durable evidence",
            focusFactionIds: [factionId("ember")],
            strategicDirections: [],
            productPositioning: "booster",
          },
        },
        ...drafts.map((draft): PublisherCommand => ({
          type: "UPDATE_CARD_DRAFT",
          expansionId: id,
          cardId: draft.id,
          draft,
        })),
        { type: "START_PLAYTEST", expansionId: id, tier: "QUICK" },
      ],
      DEFAULT_BALANCE_CONFIG,
    ).nextState;

    expect(
      Object.keys(next.operationEvidence?.playtests.runs ?? {}),
    ).toHaveLength(1);
    while (
      Object.keys(next.operationEvidence?.playtests.reports ?? {}).length === 0
    ) {
      next = simulateDay(next, [], DEFAULT_BALANCE_CONFIG).nextState;
    }
    const report = Object.values(next.operationEvidence!.playtests.reports)[0]!;
    expect(report).toMatchObject({
      expansionId: id,
      tier: "QUICK",
      status: "FRESH",
    });
    expect(report.matchesRun).toBeGreaterThan(0);
  }, 30_000);

  it("creates, playtests and irreversibly finalizes fixture drafts", () => {
    const world = createPublisherTestWorld("expansion-command-lifecycle");
    const startingCash = world.cash.balance;
    const id = expansionId("set-fixture-expansion");
    const worldCards = Object.values(world.cards);
    worldCards[20]!.rarity = "RARE";
    worldCards[21]!.rarity = "RARE";
    worldCards[22]!.rarity = "LEGENDARY";
    worldCards[23]!.rarity = "LEGENDARY";
    const drafts = worldCards.map((card, index) => ({
      ...structuredClone(card),
      id: `card-fixture-expansion-${String(index + 1).padStart(2, "0")}` as typeof card.id,
      name: `Fixture Expansion ${index + 1}`,
    }));
    const commands: PublisherCommand[] = [
      {
        type: "CREATE_EXPANSION",
        expansionId: id,
        name: "Fixture Expansion",
        size: 24,
        brief: {
          theme: "Offline regression fixture",
          focusFactionIds: [factionId("ember")],
          strategicDirections: ["exercise the full publisher pipeline"],
          productPositioning: "small follow-up set",
        },
      },
      ...drafts.map((draft): PublisherCommand => ({
        type: "UPDATE_CARD_DRAFT",
        expansionId: id,
        cardId: draft.id,
        draft,
      })),
      { type: "START_PLAYTEST", expansionId: id, tier: "QUICK" },
      { type: "FINALIZE_EXPANSION", expansionId: id },
    ];

    const result = simulateDay(world, commands, DEFAULT_BALANCE_CONFIG);
    const project = result.nextState.expansionProjects?.[id];

    expect(project).toMatchObject({ stage: "FINALIZED", size: 24 });
    expect(Object.keys(project?.finalizedCards ?? {})).toHaveLength(24);
    expect(
      Object.values(result.nextState.operations ?? {}).map(
        (operation) => operation.type,
      ),
    ).toEqual(expect.arrayContaining(["EXPANSION_DESIGN", "PLAYTEST"]));
    expect(result.nextState.cash.balance).toBeLessThan(startingCash);
    expect(result.nextState.cash.ledger).toContainEqual(
      expect.objectContaining({
        category: "EXPANSION_DESIGN",
        sourceId: expect.stringContaining("expansion-design"),
      }),
    );
    expect(result.nextState.products[`product-${id}-booster`]).toMatchObject({
      expansionId: id,
      kind: "BOOSTER",
      cardIds: drafts.map((draft) => draft.id),
    });
    expect(() =>
      simulateDay(
        result.nextState,
        [
          {
            type: "UPDATE_CARD_DRAFT",
            expansionId: id,
            cardId: drafts[0]!.id,
            draft: { ...drafts[0]!, cost: drafts[0]!.cost + 1 },
          },
        ],
        DEFAULT_BALANCE_CONFIG,
      ),
    ).toThrow(/locked/i);
  }, 30_000);

  it("advances the canonical project through physical printing and release", () => {
    const world = createPublisherTestWorld("expansion-release-lifecycle");
    const id = expansionId("set-release-expansion");
    const worldCards = Object.values(world.cards);
    worldCards[20]!.rarity = "RARE";
    worldCards[21]!.rarity = "RARE";
    worldCards[22]!.rarity = "LEGENDARY";
    worldCards[23]!.rarity = "LEGENDARY";
    const drafts = worldCards.map((card, index) => ({
      ...structuredClone(card),
      id: `card-release-expansion-${String(index + 1).padStart(2, "0")}` as typeof card.id,
    }));
    const finalized = simulateDay(
      world,
      [
        {
          type: "CREATE_EXPANSION",
          expansionId: id,
          name: "Release Expansion",
          size: 24,
          brief: {
            theme: "Release lifecycle",
            focusFactionIds: [factionId("ember")],
            strategicDirections: [],
            productPositioning: "booster",
          },
        },
        ...drafts.map((draft): PublisherCommand => ({
          type: "UPDATE_CARD_DRAFT",
          expansionId: id,
          cardId: draft.id,
          draft,
        })),
        { type: "FINALIZE_EXPANSION", expansionId: id },
      ],
      DEFAULT_BALANCE_CONFIG,
    );
    const boosterId = finalized.nextState.products[`product-${id}-booster`]!.id;
    let next = simulateDay(
      finalized.nextState,
      [
        { type: "ORDER_PRINT_RUN", productId: boosterId, quantity: 1_000 },
        {
          type: "SCHEDULE_RELEASE",
          productId: boosterId,
          releaseDay: finalized.nextState.day + 10,
        },
      ],
      DEFAULT_BALANCE_CONFIG,
    ).nextState;

    expect(next.expansionProjects?.[id]?.stage).toBe("PRINTING");
    while (next.day <= finalized.nextState.day + 10) {
      next = simulateDay(next, [], DEFAULT_BALANCE_CONFIG).nextState;
    }

    expect(next.expansionProjects?.[id]?.stage).toBe("RELEASED");
    expect(next.products[boosterId]?.releaseStatus).toBe("LIVE");
  }, 30_000);
});
