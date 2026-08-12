import {
  operationId,
  playerId,
  printRunId,
  tournamentId,
  type OperationProject,
  type WorldState,
} from "../../packages/domain/src/index";
import {
  DEFAULT_BALANCE_CONFIG,
  openStarter,
  scheduleCampaign,
  simulateDay,
} from "../../packages/sim-core/src/index";
import {
  createProductFixtureWorld,
  fireFixtureDeck,
  launchBoosterProductId,
  launchFireStarterProductId,
} from "../../packages/testkit/src/index";
import { describe, expect, it } from "vitest";

function createDeterministicPublisherWorld(): WorldState {
  const fixture = createProductFixtureWorld("publisher-world-determinism");
  const { world } = fixture;
  world.status = "LIVE";
  world.day = 20;
  const playerA = fixture.owner;
  const playerB = world.players[playerId("player-0002")]!;
  for (const player of [playerA, playerB]) {
    player.activity = "ACTIVE";
    player.deckIds = [fireFixtureDeck.id];
    player.knowledge.knownDeckIds = [fireFixtureDeck.id];
    player.knowledge.knownCardIds = fireFixtureDeck.cards.map(
      (entry) => entry.cardId,
    );
    openStarter(
      world,
      launchFireStarterProductId,
      player.id,
      fixture.starterPrintingIds,
    );
  }
  const policyCardId = Object.values(world.cards)
    .map((card) => card.id)
    .find(
      (cardId) =>
        !fireFixtureDeck.cards.some((entry) => entry.cardId === cardId),
    )!;
  const expansionId = world.products[launchBoosterProductId]!.expansionId;
  const policy: OperationProject = {
    id: operationId("operation-determinism-policy"),
    type: "POLICY_CHANGE",
    createdDay: 17,
    startDay: 20,
    completionDay: 20,
    status: "PLANNED",
    progressDays: 0,
    payload: { kind: "BAN", cardId: policyCardId },
  };
  const playtest: OperationProject = {
    id: operationId("operation-determinism-playtest"),
    type: "PLAYTEST",
    createdDay: 20,
    startDay: 20,
    completionDay: 20,
    status: "PLANNED",
    progressDays: 0,
    payload: { expansionId, tier: "QUICK" },
  };
  const tournament: OperationProject = {
    id: operationId("operation-determinism-tournament"),
    type: "TOURNAMENT",
    createdDay: 10,
    startDay: 20,
    completionDay: 20,
    status: "PLANNED",
    progressDays: 0,
    payload: { tournamentId: tournamentId("tournament-determinism-major") },
  };
  world.operations = {
    [policy.id]: policy,
    [playtest.id]: playtest,
    [tournament.id]: tournament,
  };
  const booster = world.products[launchBoosterProductId]!;
  booster.releaseStatus = "ANNOUNCED";
  booster.internalReleaseDay = 20;
  booster.announcedReleaseDay = 20;
  const runId = printRunId("print-run-determinism-due");
  world.printRuns[runId] = {
    id: runId,
    productId: booster.id,
    sourceExpansionId: booster.expansionId,
    productKind: booster.kind,
    cardIds: [...booster.cardIds],
    orderedQuantity: 100,
    quantity: 0,
    orderedDay: 15,
    completionDay: 20,
    unitCost: 1,
    totalCost: 100,
    status: "PRINTING",
    printingIds: [],
  };
  world.history.events.push({
    id: "tournament-scheduled-determinism-major",
    day: 10,
    type: "TOURNAMENT_SCHEDULED_MAJOR",
    context: {
      reason: JSON.stringify({
        tournamentId: tournament.payload.tournamentId,
        name: "Determinism Major",
      }),
    },
  });
  scheduleCampaign(world, {
    id: operationId("operation-determinism-campaign"),
    campaignType: "NEW_PLAYER_CAMPAIGN",
    durationDays: 3,
    createdDay: 19,
    startDay: 20,
  });
  return world;
}

describe("publisher world determinism", () => {
  it("reproduces the complete simultaneous publisher-operations day", () => {
    const results = Array.from({ length: 10 }, () =>
      simulateDay(
        createDeterministicPublisherWorld(),
        [],
        DEFAULT_BALANCE_CONFIG,
      ),
    );
    const baseline = results[0]!;

    for (const result of results.slice(1)) {
      expect(result.stateHash).toBe(baseline.stateHash);
      expect(result.nextState).toEqual(baseline.nextState);
      expect(result.notableEvents).toEqual(baseline.notableEvents);
      expect(result.report).toEqual(baseline.report);
    }
  });
});
